# FilterForge リポジトリ構造定義書

## 1. プロジェクト概要

FilterForge はアナログフィルタ回路設計 Web アプリケーション（SPA）である。

| 項目 | 技術 |
|------|------|
| フロントエンド | React + Vite + TypeScript |
| フィルタ演算 | Pyodide + SciPy（Web Worker + Comlink） |
| グラフ描画 | uPlot |
| 回路図描画 | カスタム SVG コンポーネント |
| スタイリング | Tailwind CSS |
| テスト | Vitest + React Testing Library |
| ホスティング | GitHub Pages |
| CI/CD | GitHub Actions |

---

## 2. ディレクトリツリー

```
filterforge/
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Pages デプロイ
├── docs/                              # プロジェクトドキュメント
│   ├── product-requirements.md        #   プロダクト要件定義
│   ├── functional-design.md           #   機能設計書
│   ├── architecture.md                #   アーキテクチャ設計書
│   ├── repository-structure.md        #   リポジトリ構造定義書（本書）
│   ├── development-guidelines.md      #   開発ガイドライン
│   └── glossary.md                    #   用語集
├── public/                            # 静的アセット
├── src/
│   ├── components/                    # React コンポーネント
│   │   ├── FilterForm/                #   FR-1: フィルタ仕様入力
│   │   │   ├── FilterForm.tsx
│   │   │   ├── FilterForm.test.tsx
│   │   │   └── index.ts
│   │   ├── FrequencyChart/            #   FR-3: 周波数特性グラフ
│   │   │   ├── FrequencyChart.tsx
│   │   │   ├── FrequencyChart.test.tsx
│   │   │   └── index.ts
│   │   ├── CircuitDiagram/            #   FR-4: 回路図
│   │   │   ├── CircuitDiagram.tsx
│   │   │   ├── symbols/               #   SVG 部品シンボル
│   │   │   │   ├── Resistor.tsx
│   │   │   │   ├── Capacitor.tsx
│   │   │   │   ├── Inductor.tsx
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── BomTable/                  #   FR-5: BOM 表示
│   │   │   ├── BomTable.tsx
│   │   │   ├── BomTable.test.tsx
│   │   │   └── index.ts
│   │   └── LoadingOverlay/            #   Pyodide 初期化プログレス
│   │       ├── LoadingOverlay.tsx
│   │       └── index.ts
│   ├── workers/                       # Web Worker
│   │   └── pyodide.worker.ts
│   ├── python/                        # Python スクリプト（SciPy）
│   │   └── filter_design.py
│   ├── hooks/                         # カスタムフック
│   │   ├── usePyodide.ts
│   │   └── useFilterDesign.ts
│   ├── types/                         # 型定義
│   │   └── filter.ts
│   ├── lib/                           # ユーティリティ
│   │   └── units.ts                   #   単位変換（pF/nF/uF 等）
│   ├── App.tsx
│   ├── App.test.tsx
│   ├── main.tsx
│   └── index.css                      # Tailwind エントリポイント
├── .eslintrc.cjs
├── .prettierrc
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── vitest.config.ts
```

---

## 3. 各ディレクトリ・ファイルの説明

### 3.1 トップレベルディレクトリ

| パス | 種別 | 説明 |
|------|------|------|
| `.github/workflows/` | CI/CD | GitHub Actions ワークフロー定義。`deploy.yml` で `main` ブランチへのプッシュ時に自動ビルド・GitHub Pages デプロイを実行する。 |
| `docs/` | ドキュメント | プロジェクトの設計ドキュメント群。要件定義・機能設計・アーキテクチャ・リポジトリ構造・開発ガイドライン・用語集を格納する。 |
| `public/` | 静的アセット | Vite がそのまま配信する静的ファイル。favicon 等を配置する。 |
| `src/` | ソースコード | アプリケーション本体のソースコード。 |

### 3.2 `src/` 配下のディレクトリ

| パス | 説明 |
|------|------|
| `src/components/` | React コンポーネント群。機能単位でサブディレクトリに分割する。各サブディレクトリは `index.ts` を持ち、バレルエクスポートを行う。 |
| `src/workers/` | Web Worker スクリプト。Pyodide の初期化と Python コード実行をメインスレッド外で行う。Comlink でメインスレッドと通信する。 |
| `src/python/` | Pyodide 上で実行する Python スクリプト。SciPy の `signal` モジュールを使用しフィルタ設計計算を行う。 |
| `src/hooks/` | カスタム React フック。Pyodide ライフサイクル管理やフィルタ設計ロジックの呼び出しをカプセル化する。 |
| `src/types/` | TypeScript 型定義。フィルタパラメータ・設計結果など、アプリケーション全体で共有する型を定義する。 |
| `src/lib/` | 汎用ユーティリティ関数。単位変換など、特定コンポーネントに依存しない共通処理を格納する。 |

### 3.3 キーファイル

| ファイル | 説明 |
|---------|------|
| `src/main.tsx` | アプリケーションエントリポイント。React ルートを生成し `App` をマウントする。 |
| `src/App.tsx` | ルートコンポーネント。全体レイアウトと各コンポーネントの配置を担う。 |
| `src/App.test.tsx` | `App` コンポーネントのテスト。 |
| `src/index.css` | Tailwind CSS のエントリポイント。`@tailwind base/components/utilities` ディレクティブを記述する。 |
| `src/workers/pyodide.worker.ts` | Pyodide Web Worker。Pyodide の初期化、micropip による SciPy インストール、Python スクリプト実行を担当する。Comlink で `expose` し、メインスレッドから透過的に呼び出し可能にする。 |
| `src/python/filter_design.py` | フィルタ設計 Python スクリプト。`scipy.signal` の `butter`, `cheby1`, `cheby2`, `bessel`, `ellip` 等を使用し、伝達関数・周波数応答・素子値を算出する。 |
| `src/hooks/usePyodide.ts` | Pyodide の初期化状態管理フック。ローディング状態・エラー状態・Worker インスタンスを提供する。 |
| `src/hooks/useFilterDesign.ts` | フィルタ設計実行フック。入力パラメータを受け取り、Worker 経由で Python 演算を実行し、設計結果を返却する。 |
| `src/types/filter.ts` | フィルタ関連の型定義。`FilterType`, `CircuitTopology`, `FilterParams`, `FilterResult`, `Component` 等を定義する。 |
| `src/lib/units.ts` | 単位変換ユーティリティ。pF/nF/uF、Ohm/kOhm、mH/uH 等の相互変換と表示フォーマットを提供する。 |

### 3.4 設定ファイル

| ファイル | 説明 |
|---------|------|
| `index.html` | Vite のエントリ HTML。`src/main.tsx` をスクリプトとして参照する。 |
| `package.json` | npm パッケージ定義。依存関係・スクリプト（`dev`, `build`, `test`, `preview`）を記述する。 |
| `vite.config.ts` | Vite 設定。React プラグイン、Web Worker 設定、ビルドオプションを定義する。 |
| `vitest.config.ts` | Vitest 設定。テスト環境（jsdom）、カバレッジ設定を定義する。 |
| `tsconfig.json` | TypeScript コンパイラ設定（アプリケーション用）。 |
| `tsconfig.node.json` | TypeScript コンパイラ設定（Vite 設定ファイル等 Node.js 用）。 |
| `tailwind.config.ts` | Tailwind CSS 設定。カスタムテーマ・プラグインを定義する。 |
| `postcss.config.js` | PostCSS 設定。Tailwind CSS と autoprefixer を登録する。 |
| `.eslintrc.cjs` | ESLint 設定。TypeScript + React 向けルールを定義する。 |
| `.prettierrc` | Prettier 設定。コードフォーマットルールを定義する。 |

---

## 4. コンポーネント構成

### 4.1 FilterForm

| 項目 | 内容 |
|------|------|
| パス | `src/components/FilterForm/FilterForm.tsx` |
| 対応要件 | FR-1: フィルタ仕様入力 |
| 責務 | フィルタ種別・近似関数・次数・カットオフ周波数・リプル等の入力フォームを提供する。バリデーション付き。 |
| 主要 Props | `onSubmit: (params: FilterParams) => void` |
| 状態管理 | フォーム内部状態はローカル state で管理する。 |

### 4.2 FrequencyChart

| 項目 | 内容 |
|------|------|
| パス | `src/components/FrequencyChart/FrequencyChart.tsx` |
| 対応要件 | FR-3: 周波数特性グラフ |
| 責務 | 振幅特性（ゲイン）・位相特性・群遅延を uPlot で描画する。対数周波数軸、dB 表示。 |
| 主要 Props | `frequencies: number[]`, `magnitude: number[]`, `phase: number[]`, `groupDelay: number[]` |

### 4.3 CircuitDiagram

| 項目 | 内容 |
|------|------|
| パス | `src/components/CircuitDiagram/CircuitDiagram.tsx` |
| 対応要件 | FR-4: 回路図 |
| 責務 | 設計結果に基づきラダー回路図を SVG で描画する。部品シンボルを組み合わせ、素子値ラベルを付与する。 |
| 主要 Props | `components: Component[]`, `topology: CircuitTopology` |
| サブコンポーネント | `symbols/Resistor.tsx`, `symbols/Capacitor.tsx`, `symbols/Inductor.tsx` |

### 4.4 BomTable

| 項目 | 内容 |
|------|------|
| パス | `src/components/BomTable/BomTable.tsx` |
| 対応要件 | FR-5: BOM 表示 |
| 責務 | 部品表をテーブル形式で表示する。CSV エクスポート機能を提供する。 |
| 主要 Props | `items: Component[]` |

### 4.5 LoadingOverlay

| 項目 | 内容 |
|------|------|
| パス | `src/components/LoadingOverlay/LoadingOverlay.tsx` |
| 対応要件 | NFR: 初期化 UX |
| 責務 | Pyodide / SciPy の初期化中にプログレスインジケータをオーバーレイ表示する。初期化完了後に自動非表示。 |
| 主要 Props | `isLoading: boolean`, `progress?: number`, `message?: string` |

---

## 5. ファイル命名規約

| 対象 | 規約 | 例 |
|------|------|-----|
| React コンポーネント | PascalCase | `FilterForm.tsx`, `FrequencyChart.tsx` |
| コンポーネントディレクトリ | PascalCase（コンポーネント名と一致） | `FilterForm/`, `CircuitDiagram/` |
| バレルエクスポート | `index.ts`（各コンポーネントディレクトリ内） | `FilterForm/index.ts` |
| カスタムフック | camelCase + `use` 接頭辞 | `usePyodide.ts`, `useFilterDesign.ts` |
| 型定義ファイル | camelCase | `filter.ts` |
| ユーティリティ | camelCase | `units.ts` |
| テストファイル | 対象ファイル名 + `.test.tsx` / `.test.ts` | `FilterForm.test.tsx` |
| Python スクリプト | snake_case | `filter_design.py` |
| Web Worker | camelCase + `.worker.ts` サフィックス | `pyodide.worker.ts` |
| 設定ファイル | 各ツールの慣例に従う | `vite.config.ts`, `.eslintrc.cjs` |
| CI/CD ワークフロー | kebab-case | `deploy.yml` |

---

## 6. インポートパス規約

- コンポーネントはバレルエクスポート経由でインポートする。
  ```ts
  import { FilterForm } from '@/components/FilterForm';
  ```
- `@/` はパスエイリアスとして `src/` を指す（`tsconfig.json` の `paths` で設定）。
- 相対インポートは同一ディレクトリ内のモジュール間に限定する。

---

## 7. テスト配置規約

- テストファイルはテスト対象と同一ディレクトリに配置する（コロケーション方式）。
- ファイル名は `{対象ファイル名}.test.tsx` または `{対象ファイル名}.test.ts` とする。
- テストユーティリティやモックが必要な場合は `src/__tests__/` 配下に共通ヘルパーを配置する。
