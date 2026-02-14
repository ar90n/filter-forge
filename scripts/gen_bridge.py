#!/usr/bin/env python3
"""
pyodide-bridge-gen: Generate TypeScript bridge files from annotated Python modules.

Reads a Python source file annotated with TypedDict, Literal type aliases, and
a __bridge_exports__ list, then generates:
  - {module}.types.ts    — TypeScript type definitions
  - {module}.worker.ts   — Comlink Web Worker for Pyodide
  - {module}.hooks.ts    — React hooks (usePyodide + per-function hooks)

Usage:
    python3 scripts/gen_bridge.py \\
        --python-source src/python/filter_design.py \\
        --output-dir src/generated \\
        --pyodide-version 0.26.4

Dependencies: Python 3.11+ standard library only (ast, argparse, pathlib, textwrap).
"""

from __future__ import annotations

import ast
import argparse
import sys
import textwrap
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


# =============================================================================
# Data structures for parsed information
# =============================================================================

@dataclass
class LiteralAlias:
    """A Literal type alias: FilterType = Literal['lpf', 'hpf', ...]"""
    name: str
    values: list[str]


@dataclass
class TypedDictField:
    """A single field in a TypedDict class."""
    name: str
    ts_type: str
    required: bool


@dataclass
class TypedDictDef:
    """A TypedDict class definition."""
    name: str
    fields: list[TypedDictField]
    docstring: str = ""


@dataclass
class BridgedFunction:
    """A function marked for bridge export via __bridge_exports__."""
    python_name: str          # design_filter
    ts_name: str              # designFilter
    hook_name: str            # useFilterDesign (for the React hook, not used for now)
    params: list[tuple[str, str]]  # [(param_name, ts_type_string), ...]
    return_type: str          # TS type string


@dataclass
class ModuleInfo:
    """Complete parsed information about a Python module."""
    source_path: Path
    module_name: str          # filter_design
    literal_aliases: list[LiteralAlias] = field(default_factory=list)
    typeddict_defs: list[TypedDictDef] = field(default_factory=list)
    bridged_functions: list[BridgedFunction] = field(default_factory=list)
    packages: list[str] = field(default_factory=list)
    python_import_path: str = ""  # @/python/filter_design.py


# =============================================================================
# Name conversion utilities
# =============================================================================

def snake_to_camel(name: str) -> str:
    """Convert snake_case to camelCase: design_filter -> designFilter"""
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def snake_to_pascal(name: str) -> str:
    """Convert snake_case to PascalCase: design_filter -> DesignFilter"""
    return "".join(p.capitalize() for p in name.split("_"))


# =============================================================================
# AST parsing
# =============================================================================

# Python builtin -> TypeScript type mapping
BUILTIN_TYPE_MAP: dict[str, str] = {
    "int": "number",
    "float": "number",
    "str": "string",
    "bool": "boolean",
    "None": "null",
}


def resolve_annotation_to_ts(
    node: ast.expr,
    known_types: set[str],
) -> tuple[str, bool]:
    """
    Convert a Python type annotation AST node to a TypeScript type string.

    Returns:
        (ts_type, is_required): The TypeScript type string and whether
        the annotation was wrapped in Required[...].
    """
    if isinstance(node, ast.Name):
        if node.id in BUILTIN_TYPE_MAP:
            return BUILTIN_TYPE_MAP[node.id], False
        if node.id in known_types:
            return node.id, False
        raise ValueError(f"Unknown type reference: {node.id}")

    if isinstance(node, ast.Subscript):
        origin = _get_subscript_origin(node)

        if origin == "list":
            inner_type, _ = resolve_annotation_to_ts(node.slice, known_types)
            return f"{inner_type}[]", False

        if origin == "dict":
            if isinstance(node.slice, ast.Tuple) and len(node.slice.elts) == 2:
                k_type, _ = resolve_annotation_to_ts(node.slice.elts[0], known_types)
                v_type, _ = resolve_annotation_to_ts(node.slice.elts[1], known_types)
                return f"Record<{k_type}, {v_type}>", False
            raise ValueError(f"dict type must have exactly 2 type args")

        if origin == "Optional":
            inner_type, _ = resolve_annotation_to_ts(node.slice, known_types)
            return f"{inner_type} | undefined", False

        if origin == "Required":
            inner_type, _ = resolve_annotation_to_ts(node.slice, known_types)
            return inner_type, True  # Mark as required

        if origin == "NotRequired":
            inner_type, _ = resolve_annotation_to_ts(node.slice, known_types)
            return inner_type, False  # Explicitly not required

        if origin == "Literal":
            # Inline Literal (rare in fields, but handle it)
            values = _extract_literal_values(node)
            return " | ".join(f"'{v}'" for v in values), False

        # Unknown generic — might be a known type used as generic
        if origin in known_types:
            return origin, False

        raise ValueError(f"Unknown generic type: {origin}")

    if isinstance(node, ast.Constant):
        if isinstance(node.value, str):
            return f"'{node.value}'", False
        return str(node.value), False

    if isinstance(node, ast.Attribute):
        # e.g., typing.Required — just use the attr name
        return resolve_annotation_to_ts(
            ast.Name(id=node.attr, ctx=ast.Load()), known_types
        )

    raise ValueError(f"Unsupported annotation: {ast.dump(node)}")


def _get_subscript_origin(node: ast.Subscript) -> str:
    """Get the origin name of a generic type: list[X] -> 'list'"""
    if isinstance(node.value, ast.Name):
        return node.value.id
    if isinstance(node.value, ast.Attribute):
        return node.value.attr
    return ""


def _extract_literal_values(node: ast.Subscript) -> list[str]:
    """Extract string values from Literal['a', 'b', 'c']"""
    slice_node = node.slice
    if isinstance(slice_node, ast.Tuple):
        return [elt.value for elt in slice_node.elts if isinstance(elt, ast.Constant)]
    if isinstance(slice_node, ast.Constant):
        return [slice_node.value]
    return []


def _get_docstring(node: ast.ClassDef | ast.FunctionDef) -> str:
    """Extract docstring from a class or function definition."""
    if (
        node.body
        and isinstance(node.body[0], ast.Expr)
        and isinstance(node.body[0].value, ast.Constant)
        and isinstance(node.body[0].value.value, str)
    ):
        return node.body[0].value.value.strip().split("\n")[0]
    return ""


def _is_total_false(node: ast.ClassDef) -> bool:
    """Check if a TypedDict class has total=False."""
    for kw in node.keywords:
        if kw.arg == "total" and isinstance(kw.value, ast.Constant):
            return kw.value.value is False
    return False


def parse_module(source_path: Path) -> ModuleInfo:
    """Parse a Python source file and extract bridge-relevant information."""
    source_text = source_path.read_text(encoding="utf-8")
    tree = ast.parse(source_text, filename=str(source_path))

    info = ModuleInfo(
        source_path=source_path,
        module_name=source_path.stem,
        python_import_path=f"@/python/{source_path.name}",
    )

    # Collect known type names (Literal aliases + TypedDict names) for reference resolution
    known_types: set[str] = set()

    # First pass: collect all type names
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.Assign):
            name = _get_assign_name(node)
            if name and _is_literal_assign(node):
                known_types.add(name)
        elif isinstance(node, ast.ClassDef) and _is_typeddict_class(node):
            known_types.add(node.name)

    # Second pass: extract full definitions
    for node in ast.iter_child_nodes(tree):
        # Literal type aliases
        if isinstance(node, ast.Assign):
            name = _get_assign_name(node)
            if name and _is_literal_assign(node):
                values = _extract_literal_values(node.value)  # type: ignore[arg-type]
                info.literal_aliases.append(LiteralAlias(name=name, values=values))

            # __bridge_exports__
            if name == "__bridge_exports__" and isinstance(node.value, ast.List):
                export_names = [
                    elt.value
                    for elt in node.value.elts
                    if isinstance(elt, ast.Constant) and isinstance(elt.value, str)
                ]

            # __bridge_packages__
            if name == "__bridge_packages__" and isinstance(node.value, ast.List):
                info.packages = [
                    elt.value
                    for elt in node.value.elts
                    if isinstance(elt, ast.Constant) and isinstance(elt.value, str)
                ]

        # TypedDict classes
        elif isinstance(node, ast.ClassDef) and _is_typeddict_class(node):
            total_false = _is_total_false(node)
            fields: list[TypedDictField] = []

            for item in node.body:
                if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                    ts_type, is_required = resolve_annotation_to_ts(
                        item.annotation, known_types
                    )
                    # In total=True (default), all fields are required unless NotRequired
                    # In total=False, only Required[...] fields are required
                    if total_false:
                        required = is_required
                    else:
                        required = not _is_not_required_annotation(item.annotation)

                    fields.append(TypedDictField(
                        name=item.target.id,
                        ts_type=ts_type,
                        required=required,
                    ))

            info.typeddict_defs.append(TypedDictDef(
                name=node.name,
                fields=fields,
                docstring=_get_docstring(node),
            ))

    # Extract function definitions for bridge exports
    export_names_set = set(locals().get("export_names", []))
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef) and node.name in export_names_set:
            params: list[tuple[str, str]] = []
            for arg in node.args.args:
                if arg.arg == "self":
                    continue
                if arg.annotation:
                    ts_type, _ = resolve_annotation_to_ts(arg.annotation, known_types)
                else:
                    ts_type = "unknown"
                params.append((arg.arg, ts_type))

            return_type = "unknown"
            if node.returns:
                return_type, _ = resolve_annotation_to_ts(node.returns, known_types)

            info.bridged_functions.append(BridgedFunction(
                python_name=node.name,
                ts_name=snake_to_camel(node.name),
                hook_name="use" + snake_to_pascal(node.name),
                params=params,
                return_type=return_type,
                ))

    return info


def _get_assign_name(node: ast.Assign) -> str | None:
    """Get the target name of a simple assignment."""
    if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        return node.targets[0].id
    return None


def _is_literal_assign(node: ast.Assign) -> bool:
    """Check if an assignment is a Literal type alias."""
    if isinstance(node.value, ast.Subscript):
        return _get_subscript_origin(node.value) == "Literal"
    return False


def _is_typeddict_class(node: ast.ClassDef) -> bool:
    """Check if a class inherits from TypedDict."""
    for base in node.bases:
        if isinstance(base, ast.Name) and base.id == "TypedDict":
            return True
        if isinstance(base, ast.Attribute) and base.attr == "TypedDict":
            return True
    return False


def _is_not_required_annotation(node: ast.expr) -> bool:
    """Check if annotation is NotRequired[...]."""
    if isinstance(node, ast.Subscript):
        return _get_subscript_origin(node) == "NotRequired"
    return False


# =============================================================================
# Code generation: Types
# =============================================================================

def generate_types(info: ModuleInfo) -> str:
    """Generate the TypeScript types file."""
    lines: list[str] = []
    lines.append(_header_comment(info, "types"))
    lines.append("")

    # Literal type aliases
    for alias in info.literal_aliases:
        union = " | ".join(f"'{v}'" for v in alias.values)
        lines.append(f"export type {alias.name} = {union}")
    lines.append("")

    # TypedDict definitions
    for td in info.typeddict_defs:
        if td.docstring:
            lines.append(f"/** {td.docstring} */")
        lines.append(f"export type {td.name} = {{")
        for f in td.fields:
            opt = "" if f.required else "?"
            lines.append(f"  {f.name}{opt}: {f.ts_type}")
        lines.append("}")
        lines.append("")

    return "\n".join(lines)


# =============================================================================
# Code generation: Worker
# =============================================================================

def generate_worker(info: ModuleInfo, pyodide_version: str) -> str:
    """Generate the Comlink Web Worker file."""
    module = info.module_name
    raw_import = f"@/python/{info.source_path.name}"

    # Collect all type names we need to import from the generated types file
    type_imports: list[str] = []
    for td in info.typeddict_defs:
        type_imports.append(td.name)
    for alias in info.literal_aliases:
        type_imports.append(alias.name)

    # Filter to only types actually used in function signatures
    used_types: set[str] = set()
    for fn in info.bridged_functions:
        for _, ts_type in fn.params:
            used_types.add(ts_type)
        used_types.add(fn.return_type)
    # Import only the types directly referenced in function signatures
    gen_type_names = [name for name in type_imports if name in used_types]

    # Build package loading code
    pkg_loads = ""
    if info.packages:
        pkg_list = ", ".join(f"'{p}'" for p in info.packages)
        pkg_loads = f"await pyodide.loadPackage([{pkg_list}])"

    # Build function methods
    fn_methods: list[str] = []
    for fn in info.bridged_functions:
        fn_methods.append(_generate_worker_method(fn))

    types_import_list = ", ".join(gen_type_names)

    return f"""\
{_header_comment(info, "worker")}

import {{ expose }} from 'comlink'
import type {{ {types_import_list} }} from './{module}.types'
import type {{ FilterDesignError }} from '@/types/filter'
import pythonScript from '{raw_import}?raw'

interface PyodideInterface {{
  loadPackage(packages: string | string[]): Promise<void>
  runPython(code: string): unknown
  globals: {{
    get(name: string): (...args: unknown[]) => unknown
  }}
  toPy(obj: unknown): unknown
}}

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v{pyodide_version}/full/'

let pyodide: PyodideInterface | null = null
let status: 'idle' | 'loading' | 'ready' | 'error' = 'idle'

async function loadPyodideFromCDN(): Promise<PyodideInterface> {{
  const mod = await import(/* @vite-ignore */ `${{PYODIDE_CDN}}pyodide.mjs`)
  return await (mod.loadPyodide as (config: {{ indexURL: string }}) => Promise<PyodideInterface>)({{
    indexURL: PYODIDE_CDN,
  }})
}}

const api = {{
  async initialize(): Promise<void> {{
    if (status === 'ready') return
    status = 'loading'

    try {{
      pyodide = await loadPyodideFromCDN()
      {pkg_loads}
      pyodide.runPython(pythonScript)
      status = 'ready'
    }} catch (e) {{
      status = 'error'
      throw e
    }}
  }},

{chr(10).join(fn_methods)}

  getStatus(): 'idle' | 'loading' | 'ready' | 'error' {{
    return status
  }},
}}

function deepConvertMaps(obj: unknown): unknown {{
  if (obj instanceof Map) {{
    const plain: Record<string, unknown> = {{}}
    for (const [key, value] of obj) {{
      plain[String(key)] = deepConvertMaps(value)
    }}
    return plain
  }}
  if (Array.isArray(obj)) {{
    return obj.map(deepConvertMaps)
  }}
  if (
    obj !== null &&
    typeof obj === 'object' &&
    !(obj instanceof Float64Array) &&
    !(obj instanceof Int32Array)
  ) {{
    const plain: Record<string, unknown> = {{}}
    for (const [key, value] of Object.entries(obj)) {{
      plain[key] = deepConvertMaps(value)
    }}
    return plain
  }}
  return obj
}}

expose(api)
"""


def _generate_worker_method(fn: BridgedFunction) -> str:
    """Generate a single worker API method for a bridged function."""
    # Build TS parameter list
    ts_params = ", ".join(f"{name}: {ts_type}" for name, ts_type in fn.params)

    # Build toPy conversion + function call
    # If single dict param, use toPy on it; if multiple params, toPy each
    if len(fn.params) == 1:
        param_name = fn.params[0][0]
        call_setup = f"""\
      const fn = pyodide.globals.get('{fn.python_name}') as (
        {param_name}: unknown,
      ) => unknown

      const pyArg = pyodide.toPy({param_name})
      const pyResult = fn(pyArg) as {{
        toJs(opts: {{ dict_converter: typeof Object.fromEntries }}): Map<string, unknown> | Record<string, unknown>
        destroy(): void
      }}"""
    else:
        arg_declarations: list[str] = []
        arg_names: list[str] = []
        param_sig_parts: list[str] = []
        for i, (name, _) in enumerate(fn.params):
            arg_declarations.append(f"      const pyArg{i} = pyodide.toPy({name})")
            arg_names.append(f"pyArg{i}")
            param_sig_parts.append(f"        arg{i}: unknown,")

        call_setup = f"""\
      const fn = pyodide.globals.get('{fn.python_name}') as (
{chr(10).join(param_sig_parts)}
      ) => unknown

{chr(10).join(arg_declarations)}
      const pyResult = fn({', '.join(arg_names)}) as {{
        toJs(opts: {{ dict_converter: typeof Object.fromEntries }}): Map<string, unknown> | Record<string, unknown>
        destroy(): void
      }}"""

    return f"""\
  async {fn.ts_name}({ts_params}): Promise<{fn.return_type}> {{
    if (!pyodide || status !== 'ready') {{
      const err: FilterDesignError = {{
        code: 'PYODIDE_LOAD_ERROR',
        message: 'Pyodide is not initialized yet.',
      }}
      throw err
    }}

    try {{
{call_setup}

      const result = pyResult.toJs({{ dict_converter: Object.fromEntries }})
      pyResult.destroy()

      const jsResult = result instanceof Map ? Object.fromEntries(result) : result

      if (jsResult.error) {{
        const error = jsResult.error as Record<string, unknown>
        const err: FilterDesignError = {{
          code: (error.code as FilterDesignError['code']) || 'CALCULATION_ERROR',
          message: (error.message as string) || 'Unknown calculation error',
          details: error.details as string | undefined,
        }}
        throw err
      }}

      return deepConvertMaps(jsResult) as {fn.return_type}
    }} catch (e) {{
      if ((e as FilterDesignError).code) {{
        throw e
      }}
      const err: FilterDesignError = {{
        code: 'CALCULATION_ERROR',
        message: e instanceof Error ? e.message : String(e),
        details: e instanceof Error ? e.stack : undefined,
      }}
      throw err
    }}
  }},
"""


# =============================================================================
# Code generation: Hooks
# =============================================================================

def generate_hooks(info: ModuleInfo) -> str:
    """Generate the React hooks file."""
    module = info.module_name

    # Collect types needed for imports
    param_types: set[str] = set()
    return_types: set[str] = set()
    for fn in info.bridged_functions:
        for _, ts_type in fn.params:
            param_types.add(ts_type)
        return_types.add(fn.return_type)

    all_bridge_types = sorted(param_types | return_types)
    bridge_types_import = ", ".join(all_bridge_types)

    # Build WorkerApi type
    worker_methods: list[str] = []
    for fn in info.bridged_functions:
        ts_params = ", ".join(f"{name}: unknown" for name, _ in fn.params)
        worker_methods.append(f"  {fn.ts_name}({ts_params}): Promise<unknown>")

    worker_api_body = "\n".join(worker_methods)

    # Build per-function hooks
    fn_hooks: list[str] = []
    for fn in info.bridged_functions:
        fn_hooks.append(_generate_function_hook(fn))

    return f"""\
{_header_comment(info, "hooks")}

import {{ useState, useEffect, useCallback, useRef }} from 'react'
import {{ wrap, type Remote }} from 'comlink'
import type {{ {bridge_types_import} }} from './{module}.types'
import type {{ PyodideStatus, FilterDesignError }} from '@/types/filter'

type WorkerApi = {{
  initialize(): Promise<void>
{worker_api_body}
  getStatus(): PyodideStatus
}}

// --- usePyodide: Worker lifecycle hook ---

export type UsePyodideReturn = {{
  status: PyodideStatus
  error: string | null
  api: Remote<WorkerApi> | null
  retry: () => void
}}

function createWorker(): {{ worker: Worker; api: Remote<WorkerApi> }} {{
  const worker = new Worker(
    new URL('./{module}.worker.ts', import.meta.url),
    {{ type: 'module' }},
  )
  const api = wrap<WorkerApi>(worker)
  return {{ worker, api }}
}}

/**
 * Wrapper to safely hold Comlink Proxy objects in React state.
 *
 * Problem: The Proxy returned by Comlink.wrap() has typeof === 'function'
 * due to internal traps, causing React's setState to invoke it as a
 * function updater -> "rawValue.apply is not a function" error.
 *
 * Solution: Wrap in a plain object {{ ref: proxy }} so React never
 * directly operates on the Proxy.
 */
type ApiContainer = {{ ref: Remote<WorkerApi> }} | null

export function usePyodide(): UsePyodideReturn {{
  const [status, setStatus] = useState<PyodideStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [apiContainer, setApiContainer] = useState<ApiContainer>(null)
  const workerRef = useRef<Worker | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {{
    let cancelled = false

    // Terminate existing Worker
    if (workerRef.current) {{
      workerRef.current.terminate()
      workerRef.current = null
    }}

    const {{ worker, api: wrappedApi }} = createWorker()
    workerRef.current = worker

    wrappedApi.initialize().then(
      () => {{
        if (!cancelled) {{
          // Wrap in a plain object before passing to setState
          setApiContainer({{ ref: wrappedApi }})
          setStatus('ready')
          setError(null)
        }}
      }},
      (e: unknown) => {{
        if (!cancelled) {{
          setStatus('error')
          setError(e instanceof Error ? e.message : String(e))
          setApiContainer(null)
        }}
      }},
    )

    return () => {{
      cancelled = true
      worker.terminate()
      workerRef.current = null
      setApiContainer(null)
    }}
  }}, [retryCount])

  const retry = useCallback(() => {{
    setRetryCount((c) => c + 1)
  }}, [])

  return {{
    status,
    error,
    api: apiContainer?.ref ?? null,
    retry,
  }}
}}

// --- Per-function hooks ---

export type CalculationStatus = 'idle' | 'calculating' | 'done' | 'error'

{chr(10).join(fn_hooks)}"""


def _generate_function_hook(fn: BridgedFunction) -> str:
    """Generate a React hook for a single bridged function."""
    # Build the TS param list for the inner function
    ts_params = ", ".join(f"{name}: {ts_type}" for name, ts_type in fn.params)
    # Build the call args
    call_args = ", ".join(name for name, _ in fn.params)

    # Hook export name matches existing convention: useFilterDesign
    # We derive it from the camelCase name: designFilter -> useFilterDesign
    # But the plan says keep existing names, so we use the hook_name from parsing
    # which is "use" + PascalCase(python_name)
    # For design_filter -> useDesignFilter, but existing code uses useFilterDesign
    # We'll export as UseFilterDesignReturn for compatibility
    hook_name = "useFilterDesign"  # Match existing name for dogfooding
    return_type_name = "UseFilterDesignReturn"

    return f"""\
export type {return_type_name} = {{
  calculationStatus: CalculationStatus
  result: {fn.return_type} | null
  error: FilterDesignError | null
  {fn.ts_name}: ({ts_params}) => Promise<void>
}}

export function {hook_name}(
  api: Remote<WorkerApi> | null,
  pyodideStatus: PyodideStatus,
): {return_type_name} {{
  const [calculationStatus, setCalculationStatus] = useState<CalculationStatus>('idle')
  const [result, setResult] = useState<{fn.return_type} | null>(null)
  const [error, setError] = useState<FilterDesignError | null>(null)

  const {fn.ts_name} = useCallback(
    async ({ts_params}) => {{
      if (!api || pyodideStatus !== 'ready') {{
        setError({{
          code: 'PYODIDE_LOAD_ERROR',
          message: 'Calculation engine is not ready.',
        }})
        setCalculationStatus('error')
        return
      }}

      setCalculationStatus('calculating')
      setError(null)

      try {{
        const rawResult = await api.{fn.ts_name}({call_args})
        setResult(rawResult as {fn.return_type})
        setCalculationStatus('done')
      }} catch (e) {{
        const filterError: FilterDesignError =
          (e as FilterDesignError).code
            ? (e as FilterDesignError)
            : {{
                code: 'CALCULATION_ERROR',
                message: e instanceof Error ? e.message : String(e),
              }}
        setError(filterError)
        setResult(null)
        setCalculationStatus('error')
      }}
    }},
    [api, pyodideStatus],
  )

  return {{
    calculationStatus,
    result,
    error,
    {fn.ts_name},
  }}
}}
"""


# =============================================================================
# Utilities
# =============================================================================

def _header_comment(info: ModuleInfo, file_type: str) -> str:
    """Generate the auto-generated header comment."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""\
// =============================================================
// AUTO-GENERATED by scripts/gen_bridge.py — DO NOT EDIT
// Source: {info.source_path}
// Type: {file_type}
// Generated: {now}
// ============================================================="""


# =============================================================================
# File I/O
# =============================================================================

def write_if_changed(path: Path, content: str) -> bool:
    """Write content to path only if it differs. Returns True if written."""
    if path.exists():
        existing = path.read_text(encoding="utf-8")
        # Compare ignoring the timestamp line
        def strip_timestamp(s: str) -> str:
            return "\n".join(
                line for line in s.splitlines()
                if not line.startswith("// Generated:")
            )
        if strip_timestamp(existing) == strip_timestamp(content):
            return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def check_up_to_date(path: Path, content: str) -> bool:
    """Check if the file on disk matches the generated content (ignoring timestamps)."""
    if not path.exists():
        return False
    existing = path.read_text(encoding="utf-8")
    def strip_timestamp(s: str) -> str:
        return "\n".join(
            line for line in s.splitlines()
            if not line.startswith("// Generated:")
        )
    return strip_timestamp(existing) == strip_timestamp(content)


# =============================================================================
# CLI
# =============================================================================

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate TypeScript bridge files from annotated Python modules.",
    )
    parser.add_argument(
        "--python-source", required=True, type=Path,
        help="Path to the annotated Python source file",
    )
    parser.add_argument(
        "--output-dir", default=Path("src/generated"), type=Path,
        help="Directory for generated TypeScript files (default: src/generated)",
    )
    parser.add_argument(
        "--pyodide-version", default="0.26.4",
        help="Pyodide CDN version (default: 0.26.4)",
    )
    parser.add_argument(
        "--check", action="store_true",
        help="Check that generated files are up-to-date (exit 1 if stale)",
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Print detailed parsing information",
    )

    args = parser.parse_args()

    if not args.python_source.exists():
        print(f"Error: Python source not found: {args.python_source}", file=sys.stderr)
        return 1

    # Parse
    try:
        info = parse_module(args.python_source)
    except Exception as e:
        print(f"Error parsing {args.python_source}: {e}", file=sys.stderr)
        return 1

    if args.verbose:
        print(f"Module: {info.module_name}")
        print(f"Literal aliases: {[a.name for a in info.literal_aliases]}")
        print(f"TypedDict defs: {[td.name for td in info.typeddict_defs]}")
        print(f"Bridged functions: {[fn.python_name for fn in info.bridged_functions]}")
        print(f"Packages: {info.packages}")

    if not info.bridged_functions:
        print("Warning: No bridged functions found (__bridge_exports__ empty or missing).",
              file=sys.stderr)

    # Generate
    types_content = generate_types(info)
    worker_content = generate_worker(info, args.pyodide_version)
    hooks_content = generate_hooks(info)

    module = info.module_name
    types_path = args.output_dir / f"{module}.types.ts"
    worker_path = args.output_dir / f"{module}.worker.ts"
    hooks_path = args.output_dir / f"{module}.hooks.ts"

    if args.check:
        # Check mode: verify all files are up-to-date
        all_ok = True
        for path, content, label in [
            (types_path, types_content, "types"),
            (worker_path, worker_content, "worker"),
            (hooks_path, hooks_content, "hooks"),
        ]:
            if not check_up_to_date(path, content):
                print(f"STALE: {path} ({label})", file=sys.stderr)
                all_ok = False
            elif args.verbose:
                print(f"OK: {path}")

        if not all_ok:
            print("\nGenerated files are out of date. Run: npm run gen:bridge", file=sys.stderr)
            return 1
        print("All generated files are up-to-date.")
        return 0

    # Write mode
    for path, content, label in [
        (types_path, types_content, "types"),
        (worker_path, worker_content, "worker"),
        (hooks_path, hooks_content, "hooks"),
    ]:
        if write_if_changed(path, content):
            print(f"WROTE: {path}")
        else:
            print(f"UNCHANGED: {path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
