# FilterForge 開発ガイドライン

## プロジェクト概要

FilterForge はアナログフィルタ回路設計 Web アプリケーション（SPA）である。

**技術スタック:**

- フロントエンド: React + Vite + TypeScript (strict)
- 計算エンジン: Pyodide + SciPy (Web Worker + Comlink)
- グラフ描画: uPlot
- 回路図: カスタム SVG
- スタイリング: Tailwind CSS
- テスト: Vitest + React Testing Library
- ホスティング: GitHub Pages
- CI/CD: GitHub Actions

---

## 1. 開発環境セットアップ

### 必要条件

- **Node.js**: LTS バージョン推奨（v20 以上）
- **npm**: Node.js に同梱のバージョン

### セットアップ手順

```bash
# リポジトリのクローン
git clone <repository-url>
cd filter_forge

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

### npm スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動（HMR 有効） |
| `npm run build` | プロダクションビルド |
| `npm run preview` | ビルド成果物のプレビュー |
| `npm run test` | テスト実行（watch モード） |
| `npm run test -- --run` | テスト実行（1回のみ） |
| `npm run lint` | ESLint 実行 |

### Pyodide について

- 開発時・本番時ともに CDN からロードする
- ローカルに Pyodide をインストールする必要はない
- ネットワーク接続が必要

---

## 2. コーディング規約

### TypeScript

- **strict モード必須**: `tsconfig.json` の `strict: true` を変更しない
- **`any` の使用禁止**: Pyodide FFI 境界のみ例外とし、その場合はコメントで理由を明記する
- **型定義の集約**: 共有型は `src/types/` ディレクトリに配置する
- **union type の優先**: `enum` ではなく union type を使用する

```typescript
// Good
type FilterType = 'lpf' | 'hpf' | 'bpf' | 'bef' | 'apf';

// Bad
enum FilterType {
  Lpf = 'lpf',
  Hpf = 'hpf',
}
```

### React

- **関数コンポーネントのみ**: class コンポーネントは使用しない
- **カスタムフックによる副作用の分離**: 副作用ロジックは `use` プレフィックスのカスタムフックに切り出す
- **props 型定義**: 各コンポーネントファイル内で `Props` 型を定義する
- **メモ化の方針**: `useMemo`, `useCallback` はパフォーマンス問題が計測で確認された場合にのみ適用する。推測に基づく事前最適化は行わない

```typescript
// props 型定義の例
type Props = {
  frequency: number;
  onFrequencyChange: (value: number) => void;
};

export function FrequencyInput({ frequency, onFrequencyChange }: Props) {
  // ...
}
```

### Tailwind CSS

- **インラインユーティリティクラスを基本とする**
- **長いクラス列の対処**: ユーティリティクラスが長くなる場合は `@apply` でコンポーネント用クラスを作成する
- **カラーパレット管理**: 色の定義は `tailwind.config.ts` で一元管理する。ハードコードされた色値を直接記述しない

---

## 3. Pyodide Worker 通信パターン

### 基本アーキテクチャ

Pyodide は Web Worker 内で実行し、Comlink でラップされた非同期 API を通じてメインスレッドと通信する。

### 型定義

Worker API の型定義は `src/types/filter.ts` で管理する。メインスレッド側と Worker 側で同じ型を共有すること。

### Python から JavaScript への型変換

- Python オブジェクトは `.toJs()` を使用して即座に JavaScript の値に変換する
- Pyodide の Proxy オブジェクトを保持し続けるとメモリリークの原因になるため、変換後は速やかに `.destroy()` で破棄する

```typescript
// Good: すぐに JS 値に変換して Proxy を破棄
const result = pyResult.toJs();
pyResult.destroy();

// Bad: Proxy を保持し続ける（メモリリーク）
const result = pyResult;
```

### エラーハンドリング

- Worker 内で発生するエラーは try-catch でキャッチする
- エラーはメインスレッドに伝搬させ、UI 上に適切なメッセージを表示する
- Python の例外メッセージはユーザーにとって不親切な場合があるため、適切に変換する

```typescript
try {
  const response = await workerApi.designFilter(params);
  // 結果を処理
} catch (error) {
  // UI にエラーを表示
  setError('フィルタ計算中にエラーが発生しました');
  console.error('Worker error:', error);
}
```

---

## 4. テスト戦略

### 単体テスト（Vitest）

- **対象**: `src/lib/` のユーティリティ関数、型定義のバリデーションロジック
- **カバレッジ目標**: 80% 以上
- **実行コマンド**:

```bash
# テスト実行
npm run test

# カバレッジ付き
npm run test -- --coverage
```

### コンポーネントテスト（React Testing Library）

- **ユーザー視点でテスト**: 入力、選択、クリックなどのユーザーインタラクションを検証する
- **Pyodide Worker のモック**: Worker は必ずモックし、計算結果を固定値で返す
- **スナップショットテストは使用しない**: 変更に脆く、レビューの質が低下するため

```typescript
// コンポーネントテストの例
test('周波数を入力するとフィルタ計算が実行される', async () => {
  const user = userEvent.setup();
  render(<FilterDesigner />);

  await user.type(screen.getByLabelText('カットオフ周波数'), '1000');
  await user.click(screen.getByRole('button', { name: '計算' }));

  expect(await screen.findByText(/計算結果/)).toBeInTheDocument();
});
```

### 計算精度テスト

- **リファレンス比較**: SciPy のリファレンス出力と計算結果を比較する
- **テストマトリックス**: 各近似関数 × 各フィルタ種別の組み合わせを網羅する
- **許容誤差**: ±0.1%

---

## 5. Git 運用

### ブランチ戦略

| ブランチ | 用途 |
|---------|------|
| `main` | 本番ブランチ（GitHub Pages デプロイ対象） |
| `feature/<機能名>` | 機能開発ブランチ |
| `fix/<修正内容>` | バグ修正ブランチ |

### コミットメッセージ規約

[Conventional Commits](https://www.conventionalcommits.org/) 形式に従う。

| プレフィックス | 用途 |
|-------------|------|
| `feat:` | 新機能 |
| `fix:` | バグ修正 |
| `docs:` | ドキュメント |
| `refactor:` | リファクタリング |
| `test:` | テスト |
| `chore:` | その他（ビルド設定、依存関係更新など） |

```bash
# コミットメッセージの例
git commit -m "feat: Chebyshev Type II フィルタの設計機能を追加"
git commit -m "fix: 帯域通過フィルタの周波数応答グラフが反転する問題を修正"
git commit -m "refactor: Worker 通信の型定義を filter.ts に集約"
```

### PR ルール

- `main` ブランチへの直接プッシュは禁止する
- CI（lint, typecheck, test）がすべてパスしていることを必須とする
- 機能ブランチから `main` への PR を作成してマージする

---

## 6. CI/CD

### GitHub Actions ワークフロー

#### プッシュ時（全ブランチ）

以下のチェックを実行する:

1. **lint**: コードスタイルの検証
2. **typecheck**: TypeScript の型チェック（`tsc --noEmit`）
3. **test**: Vitest によるテスト実行

#### main マージ時

1. **build**: `npm run build` でプロダクションビルドを生成
2. **deploy**: `dist/` ディレクトリを GitHub Pages にデプロイ

### デプロイ設定

- **ビルドコマンド**: `npm run build`
- **出力ディレクトリ**: `dist/`
- **デプロイ方式**: GitHub Pages の GitHub Actions デプロイ方式を使用する
- **ベースパス**: `vite.config.ts` の `base` オプションでリポジトリ名に合わせたパスを設定する

```typescript
// vite.config.ts
export default defineConfig({
  base: '/<repository-name>/',
  // ...
});
```

---

## 7. パフォーマンスガイドライン

### Pyodide の実行

- **Web Worker 必須**: Pyodide は必ず Web Worker 内で実行する。メインスレッドでの実行はブロッキングを引き起こすため禁止する

### uPlot のデータ更新

- **一括更新**: uPlot のデータは `setData()` で一括更新する。部分的なデータ変更を繰り返さない
- 頻繁なグラフ再描画はパフォーマンス劣化の原因となるため、計算完了後に一度だけ更新する

### React 再レンダリングの最小化

- **計算結果の参照安定性**: 計算結果のオブジェクト参照が不必要に変わらないようにする
- 新しいオブジェクトの生成はレンダリングのたびに行わず、値が実際に変化した場合のみ新しい参照を作成する
- 状態の粒度を適切に設計し、関連しないコンポーネントの再レンダリングを防ぐ
