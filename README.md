# FilterForge

[![Deploy](https://github.com/ar90n/filter-forge/actions/workflows/deploy.yml/badge.svg)](https://github.com/ar90n/filter-forge/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Pyodide](https://img.shields.io/badge/Pyodide-0.26.4-yellow.svg)](https://pyodide.org/)
![Built with vibe coding](https://img.shields.io/badge/built%20with-vibe%20coding-ff69b4)

An analog filter circuit designer that runs entirely in the browser. Compute component values, visualize frequency response, and generate circuit diagrams for LC passive and active Sallen-Key filters.

**Live demo: [https://ar90n.github.io/filter-forge/](https://ar90n.github.io/filter-forge/)**

## Key Characteristics

- **Fully client-side** -- all computation runs in the browser via Pyodide (SciPy / NumPy)
- **LC Passive filters** -- LPF, HPF, BPF, BEF, APF with Butterworth, Chebyshev, Bessel, Elliptic approximations
- **Active Sallen-Key filters** -- LPF, HPF with cascaded 2nd-order stages
- **Interactive visualization** -- frequency response chart, transfer function (LaTeX), circuit diagram, BOM table

## Usage

Select a filter type, characteristics, approximation, and parameters, then click **Calculate**.

| Filter Type | Characteristics | Order |
|-------------|----------------|-------|
| LC Passive | LPF, HPF, BPF, BEF, APF | 1--10 |
| Active (Sallen-Key) | LPF, HPF | 2, 4, 6, 8, 10 (even only) |

## Build & Test

```bash
npm install     # install dependencies
npm run dev     # start dev server
npm run test    # run all tests
npm run build   # production build
npm run lint    # lint
```

## Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| UI | React 19 + Tailwind CSS | Filter parameter form, result display |
| Visualization | uPlot, KaTeX | Frequency response chart, transfer function rendering |
| Circuit Diagram | SVG (custom) | Schematic rendering with glyphs for R, L, C, op-amp |
| Computation | Python (SciPy) via Pyodide Web Worker | Filter design, component value calculation |
| Bridge | Comlink + code generation | Type-safe Python--TypeScript interface |

## Project Structure

```
filter-forge/
  src/
    App.tsx                   # main application
    components/
      FilterForm/             # parameter input form
      FrequencyChart/         # frequency response plot (uPlot)
      TransferFunction/       # H(s) display (KaTeX)
      CircuitDiagram/         # SVG circuit schematic
      BomTable/               # bill of materials table
    python/
      filter_design.py        # filter design engine (SciPy)
    generated/
      filter_design.types.ts  # auto-generated TypeScript types
    hooks/                    # React hooks (Pyodide worker bridge)
    lib/                      # utilities (unit formatting)
  scripts/
    gen_bridge.py             # Python-to-TypeScript type generator
  .github/workflows/
    deploy.yml                # GitHub Pages CI/CD
```

## Design Conventions

- Filter computation is offloaded to a Web Worker to keep the UI responsive
- TypeScript types for the Python bridge are auto-generated from `filter_design.py`
- Circuit diagrams use pure SVG with no external drawing libraries
- Sallen-Key topology follows the Wikipedia convention with junction dots at bifurcation points
