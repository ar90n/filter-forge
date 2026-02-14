# FilterForge アーキテクチャ設計書

## 1. システム概要

### 1.1 システム構成図

```
┌─────────────────────────────────────────────────────┐
│                    ブラウザ                           │
│                                                     │
│  ┌───────────────────────┐    ┌───────────────────┐ │
│  │     メインスレッド      │    │   Web Worker      │ │
│  │                       │    │                   │ │
│  │  ┌─────────────────┐  │    │  ┌─────────────┐  │ │
│  │  │  React App      │  │    │  │  Pyodide    │  │ │
│  │  │  ├ FilterForm   │  │    │  │  ├ SciPy    │  │ │
│  │  │  ├ FreqChart    │  │    │  │  │ .signal  │  │ │
│  │  │  ├ CircuitDiag  │  │    │  │  └──────────│  │ │
│  │  │  ├ BomTable     │  │    │  │  filter_    │  │ │
│  │  │  └ LoadOverlay  │  │    │  │  design.py  │  │ │
│  │  └─────────────────┘  │    │  └─────────────┘  │ │
│  │           │           │    │        │          │ │
│  │  ┌────────┴────────┐  │    │  ┌─────┴───────┐  │ │
│  │  │  Comlink Proxy  │◄─┼────┼─►│ Comlink     │  │ │
│  │  │  (wrap)         │  │    │  │ (expose)    │  │ │
│  │  └─────────────────┘  │    │  └─────────────┘  │ │
│  └───────────────────────┘    └───────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  uPlot (グラフ描画)                             │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
          │                           │
          ▼                           ▼
   GitHub Pages              CDN (jsdelivr)
   (静的ホスティング)           (Pyodide + SciPy)
```

### 1.2 技術スタック一覧

| レイヤー | 技術 | バージョン管理 |
|---------|------|-------------|
| UI フレームワーク | React | package.json |
| ビルドツール | Vite | package.json |
| 型システム | TypeScript (strict) | tsconfig.json |
| 計算エンジン | Pyodide + SciPy | CDN バージョン指定 |
| Worker 通信 | Comlink | package.json |
| グラフ描画 | uPlot | package.json |
| スタイリング | Tailwind CSS | package.json |
| テスト | Vitest + React Testing Library | package.json |

---

## 2. レイヤーアーキテクチャ

### 2.1 3層構成

```
┌─────────────────────────────────────────────┐
│  Presentation Layer（プレゼンテーション層）     │
│  React コンポーネント + uPlot + SVG           │
│  FilterForm / FrequencyChart / CircuitDiagram │
│  BomTable / LoadingOverlay                    │
├─────────────────────────────────────────────┤
│  Application Layer（アプリケーション層）        │
│  カスタムフック + 状態管理                      │
│  usePyodide / useFilterDesign                │
│  Context + useReducer                        │
├─────────────────────────────────────────────┤
│  Computation Engine Layer（計算エンジン層）     │
│  Web Worker + Pyodide + SciPy               │
│  pyodide.worker.ts / filter_design.py        │
└─────────────────────────────────────────────┘
```

### 2.2 各層の責務

| 層 | 責務 | 通信方向 |
|----|------|---------|
| Presentation | UI 描画、ユーザー入力の受け付け、グラフ/回路図の描画 | → Application |
| Application | 状態管理、パラメータバリデーション、Worker 通信の抽象化 | ↔ Computation |
| Computation | フィルタ設計計算（SciPy）、伝達関数算出、素子値算出 | → Application |

---

## 3. データフロー

### 3.1 フィルタ設計フロー

```
[ユーザー入力]
     │
     ▼
[FilterForm: パラメータ収集]
     │
     ▼
[useFilterDesign: バリデーション]
     │
     ├── NG → バリデーションエラー表示
     │
     ▼ OK
[Comlink Proxy: designFilter(params)]
     │
     ▼
[Web Worker: Python スクリプト実行]
     │
     ├── scipy.signal.butter / cheby1 / cheby2 / bessel / ellip
     ├── scipy.signal.freqs (周波数応答)
     ├── scipy.signal.group_delay (群遅延)
     └── ラダー合成 (素子値算出)
     │
     ▼
[.toJs() → JavaScript オブジェクト変換]
[.destroy() → Proxy 解放]
     │
     ▼
[FilterResult を返却]
     │
     ├── FrequencyChart: グラフ更新 (uPlot.setData)
     ├── CircuitDiagram: 回路図再描画 (SVG)
     └── BomTable: 部品表更新
```

### 3.2 Pyodide 初期化フロー

```
[App マウント]
     │
     ▼
[usePyodide: Worker 生成]
     │
     ▼
[Worker: loadPyodide()]  ←── CDN (jsdelivr)
     │                        pyodide.js + wasm
     ▼
[Worker: micropip.install('scipy')]
     │
     ▼
[Worker: filter_design.py ロード]
     │
     ▼
[Comlink expose → ready]
     │
     ▼
[メインスレッド: pyodideStatus = 'ready']
[LoadingOverlay 非表示]
```

#### 初期化中の UI 状態

| フェーズ | 進捗 (%) | 表示メッセージ |
|---------|---------|---------------|
| Pyodide ロード | 0 - 40 | 「計算エンジンを読み込み中...」 |
| SciPy インストール | 40 - 80 | 「数値計算ライブラリをインストール中...」 |
| Python スクリプト登録 | 80 - 100 | 「初期化を完了しています...」 |

---

## 4. 技術的決定事項

### 4.1 Vite 設定

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/<repository-name>/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: ['pyodide'],    // Pyodide は CDN からロードするため除外
  },
  worker: {
    format: 'es',            // Web Worker を ES モジュール形式でバンドル
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          uplot: ['uplot'],  // uPlot を別チャンクに分離
        },
      },
    },
  },
});
```

### 4.2 Pyodide CDN 設定

```typescript
// Worker 内で使用
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

const pyodide = await loadPyodide({
  indexURL: PYODIDE_CDN,
});
await pyodide.loadPackage('scipy');
```

- バージョンを固定して再現性を確保
- jsdelivr は GitHub Pages と同じ CDN 圏のため低レイテンシ
- ブラウザキャッシュにより2回目以降は高速ロード

### 4.3 Comlink 設定

```typescript
// Worker 側 (pyodide.worker.ts)
import { expose } from 'comlink';

const api: FilterDesignWorker = {
  async initialize() { /* Pyodide 初期化 */ },
  async designFilter(params) { /* フィルタ設計 */ },
  async getStatus() { /* ステータス返却 */ },
};

expose(api);

// メインスレッド側 (usePyodide.ts)
import { wrap } from 'comlink';

const worker = new Worker(
  new URL('../workers/pyodide.worker.ts', import.meta.url),
  { type: 'module' }
);
const api = wrap<FilterDesignWorker>(worker);
```

### 4.4 uPlot 設定

```typescript
// 3パネル共通設定
const commonOpts = {
  cursor: {
    sync: {
      key: 'filterforge',   // 3パネル間でカーソル同期
      setSeries: true,
    },
  },
  scales: {
    x: {
      distr: 3,              // log10 スケール
    },
  },
};
```

### 4.5 Tailwind CSS 設定

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { /* アプリケーションカラー */ },
      },
    },
  },
};

export default config;
```

---

## 5. ビルド・デプロイパイプライン

### 5.1 GitHub Actions ワークフロー

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run test -- --run

  deploy:
    needs: check
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 5.2 ビルド成果物

| 成果物 | サイズ目標 | 説明 |
|--------|----------|------|
| `index.html` | < 1 KB | エントリ HTML |
| `assets/index-*.js` | < 200 KB (gzip) | React + App バンドル |
| `assets/uplot-*.js` | < 50 KB (gzip) | uPlot チャンク |
| `assets/index-*.css` | < 10 KB (gzip) | Tailwind CSS (purged) |

Pyodide / SciPy は CDN から別途ロードされるためビルド成果物に含まれない。

---

## 6. テストアーキテクチャ

### 6.1 テスト層

| テスト種別 | ツール | 対象 | 実行タイミング |
|-----------|-------|------|-------------|
| 単体テスト | Vitest | `src/lib/`, 型バリデーション | `npm run test` |
| コンポーネントテスト | Vitest + RTL | React コンポーネント | `npm run test` |
| 計算精度テスト | Vitest (+ Pyodide mock) | SciPy リファレンス値との比較 | `npm run test` |

### 6.2 Pyodide のモック方針

- Worker をモックし、固定の `FilterResult` を返却する
- 計算精度テストのみ、リファレンスデータセットを JSON ファイルとして管理
- SciPy の直接実行テストは CI では行わない（Pyodide の CI ロードが不安定なため）

---

## 7. セキュリティ

### 7.1 Content Security Policy

GitHub Pages ではカスタムレスポンスヘッダを設定できないため、meta タグで CSP を定義する。

```html
<meta http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net;
    worker-src 'self' blob:;
    connect-src 'self' https://cdn.jsdelivr.net https://files.pythonhosted.org;
    style-src 'self' 'unsafe-inline';
  "
>
```

| ディレクティブ | 理由 |
|-------------|------|
| `wasm-unsafe-eval` | Pyodide の WebAssembly 実行に必要 |
| `https://cdn.jsdelivr.net` | Pyodide CDN からのスクリプトロード |
| `blob:` (worker-src) | Vite のワーカーバンドルが blob URL を使用 |
| `https://files.pythonhosted.org` | micropip が PyPI からパッケージをダウンロード |

### 7.2 GitHub Pages の制約

| 制約 | 影響 | 対策 |
|------|------|------|
| カスタムレスポンスヘッダ不可 | `Cross-Origin-Isolation` ヘッダを設定できない | SharedArrayBuffer 不使用。Pyodide interrupt 不可 |
| HTTPS 強制 | なし（セキュリティ上は好ましい） | - |
| ファイルサイズ制限 100MB | Pyodide を同梱不可 | CDN 利用（設計通り） |

### 7.3 長時間計算のキャンセル

SharedArrayBuffer が使えないため Pyodide の interrupt API は使用不可。代替として:

1. 計算開始から一定時間（5秒）経過後に「キャンセル」ボタンを表示
2. キャンセル時は `worker.terminate()` で Worker を終了
3. 新しい Worker を生成して再初期化（Pyodide の再ロードが必要）
