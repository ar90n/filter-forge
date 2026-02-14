# FilterForge 機能設計書

## 1. 画面レイアウト

### 1.1 全体構成

シングルページアプリケーション（SPA）として、以下のエリアで構成する。

```
┌─────────────────────────────────────────────────────────┐
│  ヘッダー（アプリ名 + Pyodide ステータス）                │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  入力パネル   │  メイン表示エリア                         │
│  (FilterForm)│  ┌──────────────────────────────────┐    │
│              │  │ 周波数特性グラフ (FrequencyChart) │    │
│  - フィルタ   │  │  振幅 / 位相 / 群遅延            │    │
│    種別選択   │  └──────────────────────────────────┘    │
│  - 近似関数   │  ┌────────────────┬─────────────────┐    │
│    選択       │  │ 回路図          │ BOM テーブル    │    │
│  - パラメータ │  │ (CircuitDiagram)│ (BomTable)      │    │
│    入力       │  │                │                 │    │
│  - 計算ボタン │  └────────────────┴─────────────────┘    │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  フッター                                               │
└─────────────────────────────────────────────────────────┘
```

### 1.2 レスポンシブ対応

| 画面幅 | レイアウト |
|--------|-----------|
| 1280px 以上 | 左: 入力パネル（固定幅 320px）、右: メイン表示（残り幅） |
| 768px - 1279px | 上: 入力パネル（全幅、折りたたみ可能）、下: メイン表示 |
| 768px 未満 | 縮退表示。タブ切り替えで各エリアを表示 |

---

## 2. FR-1: フィルタ仕様入力

### 2.1 フォーム構成

#### フィルタ種別選択

| 値 | 表示名 | 説明 |
|----|--------|------|
| `lpf` | Low-Pass Filter (LPF) | 低域通過フィルタ |
| `hpf` | High-Pass Filter (HPF) | 高域通過フィルタ |
| `bpf` | Band-Pass Filter (BPF) | 帯域通過フィルタ |
| `bef` | Band-Elimination Filter (BEF) | 帯域除去フィルタ |
| `apf` | All-Pass Filter (APF) | 全域通過フィルタ |

#### 近似関数選択

| 値 | 表示名 | 表示条件 |
|----|--------|----------|
| `butterworth` | Butterworth | APF 以外 |
| `chebyshev1` | Chebyshev Type I | APF 以外 |
| `chebyshev2` | Chebyshev Type II | APF 以外 |
| `bessel` | Bessel | APF 以外 |
| `elliptic` | Elliptic (Cauer) | APF 以外 |

APF 選択時は近似関数セレクタを非表示とする。

### 2.2 パラメータ入力の条件分岐

#### LPF / HPF

| パラメータ | 入力種別 | 単位 | 表示条件 |
|-----------|---------|------|----------|
| カットオフ周波数 | 数値 + 単位選択 | Hz / kHz / MHz | 常時 |
| フィルタ次数 | 数値（整数） | - | 常時 |
| 通過帯域リップル | 数値 | dB | Chebyshev I, Elliptic |
| 阻止帯域減衰量 | 数値 | dB | Chebyshev II, Elliptic |
| ソースインピーダンス | 数値 | Ω | 常時 |
| 負荷インピーダンス | 数値 | Ω | 常時 |

#### BPF / BEF

| パラメータ | 入力種別 | 単位 | 表示条件 |
|-----------|---------|------|----------|
| 中心周波数 | 数値 + 単位選択 | Hz / kHz / MHz | 常時 |
| 帯域幅 | 数値 + 単位選択 | Hz / kHz / MHz | 常時 |
| フィルタ次数 | 数値（整数） | - | 常時 |
| 通過帯域リップル | 数値 | dB | Chebyshev I, Elliptic |
| 阻止帯域減衰量 | 数値 | dB | Chebyshev II, Elliptic |
| ソースインピーダンス | 数値 | Ω | 常時 |
| 負荷インピーダンス | 数値 | Ω | 常時 |

#### APF

| パラメータ | 入力種別 | 単位 | 表示条件 |
|-----------|---------|------|----------|
| 中心周波数 | 数値 + 単位選択 | Hz / kHz / MHz | 常時 |
| フィルタ次数 | 数値（整数） | - | 常時 |
| ソースインピーダンス | 数値 | Ω | 常時 |
| 負荷インピーダンス | 数値 | Ω | 常時 |

### 2.3 バリデーションルール

| パラメータ | ルール | エラーメッセージ |
|-----------|--------|----------------|
| カットオフ周波数 | > 0 | 「カットオフ周波数は正の値を入力してください」 |
| 中心周波数 | > 0 | 「中心周波数は正の値を入力してください」 |
| 帯域幅 | > 0, < 中心周波数 × 2 | 「帯域幅は正の値で、中心周波数の2倍未満にしてください」 |
| フィルタ次数 | 1 ≦ n ≦ 10, 整数 | 「フィルタ次数は1〜10の整数を入力してください」 |
| 通過帯域リップル | > 0 | 「リップルは正の値を入力してください」 |
| 阻止帯域減衰量 | > 0 | 「減衰量は正の値を入力してください」 |
| ソースインピーダンス | > 0 | 「インピーダンスは正の値を入力してください」 |
| 負荷インピーダンス | > 0 | 「インピーダンスは正の値を入力してください」 |

### 2.4 デフォルト値

| パラメータ | デフォルト値 |
|-----------|------------|
| フィルタ種別 | LPF |
| 近似関数 | Butterworth |
| カットオフ周波数 | 1 kHz |
| フィルタ次数 | 3 |
| 通過帯域リップル | 1 dB |
| 阻止帯域減衰量 | 40 dB |
| ソースインピーダンス | 50 Ω |
| 負荷インピーダンス | 50 Ω |

---

## 3. FR-2: フィルタ設計計算

### 3.1 Worker API インターフェース

```typescript
// フィルタ種別
type FilterType = 'lpf' | 'hpf' | 'bpf' | 'bef' | 'apf';

// 近似関数
type Approximation = 'butterworth' | 'chebyshev1' | 'chebyshev2' | 'bessel' | 'elliptic';

// 設計パラメータ（メインスレッド → Worker）
interface FilterParams {
  filterType: FilterType;
  approximation?: Approximation;       // APF の場合は undefined
  order: number;                        // フィルタ次数 (1-10)
  cutoffFrequency?: number;             // LPF/HPF: カットオフ周波数 [Hz]
  centerFrequency?: number;             // BPF/BEF/APF: 中心周波数 [Hz]
  bandwidth?: number;                   // BPF/BEF: 帯域幅 [Hz]
  passbandRipple?: number;              // Chebyshev I / Elliptic: 通過帯域リップル [dB]
  stopbandAttenuation?: number;         // Chebyshev II / Elliptic: 阻止帯域減衰量 [dB]
  sourceImpedance: number;              // ソースインピーダンス [Ω]
  loadImpedance: number;                // 負荷インピーダンス [Ω]
}

// 周波数応答データ
interface FrequencyResponse {
  frequencies: number[];                // 周波数配列 [Hz]
  magnitude: number[];                  // 振幅 [dB]
  phase: number[];                      // 位相 [度]
  groupDelay: number[];                 // 群遅延 [秒]
}

// 回路部品
interface Component {
  id: string;                           // 部品記号 (C1, L1, R1...)
  type: 'capacitor' | 'inductor' | 'resistor';
  value: number;                        // 設計値 [F, H, Ω]
  position: 'series' | 'shunt';         // 直列 or 並列
}

// 回路トポロジ
type CircuitTopology = 'ladder-t' | 'ladder-pi' | 'lattice';

// 設計結果（Worker → メインスレッド）
interface FilterResult {
  transferFunction: {
    numerator: number[];                // 伝達関数の分子係数
    denominator: number[];              // 伝達関数の分母係数
  };
  frequencyResponse: FrequencyResponse;
  components: Component[];
  circuitTopology: CircuitTopology;
}

// Worker API
interface FilterDesignWorker {
  initialize(): Promise<void>;
  designFilter(params: FilterParams): Promise<FilterResult>;
  getStatus(): Promise<'loading' | 'ready' | 'error'>;
}

// エラー型
interface FilterDesignError {
  code: 'PYODIDE_LOAD_ERROR' | 'INVALID_PARAMS' | 'CALCULATION_ERROR';
  message: string;
  details?: string;
}
```

### 3.2 SciPy 関数マッピング

| 近似関数 | SciPy 関数 | 主要パラメータ |
|----------|-----------|---------------|
| Butterworth | `scipy.signal.butter` | `N`, `Wn`, `btype`, `analog=True` |
| Chebyshev Type I | `scipy.signal.cheby1` | `N`, `rp`, `Wn`, `btype`, `analog=True` |
| Chebyshev Type II | `scipy.signal.cheby2` | `N`, `rs`, `Wn`, `btype`, `analog=True` |
| Bessel | `scipy.signal.bessel` | `N`, `Wn`, `btype`, `analog=True`, `norm='mag'` |
| Elliptic (Cauer) | `scipy.signal.ellip` | `N`, `rp`, `rs`, `Wn`, `btype`, `analog=True` |

#### 共通処理

| 処理 | SciPy 関数 |
|------|-----------|
| 周波数応答 | `scipy.signal.freqs(b, a, worN)` |
| 群遅延 | `scipy.signal.group_delay((b, a), w)` |
| 伝達関数変換 | `scipy.signal.tf2zpk(b, a)` |

#### btype パラメータ対応

| FilterType | btype |
|-----------|-------|
| `lpf` | `'lowpass'` |
| `hpf` | `'highpass'` |
| `bpf` | `'bandpass'` |
| `bef` | `'bandstop'` |

### 3.3 計算フロー

1. メインスレッドから `FilterParams` を Comlink 経由で Worker に送信
2. Worker 内で Python スクリプトを実行
3. SciPy で伝達関数（`b`, `a` 多項式係数）を算出
4. 周波数応答（振幅、位相、群遅延）を算出
5. 伝達関数から回路素子値を算出（ラダー合成法）
6. 結果を `.toJs()` で JavaScript オブジェクトに変換し返却
7. Proxy オブジェクトを `.destroy()` で解放

---

## 4. FR-3: 特性表示（周波数特性グラフ）

### 4.1 グラフ構成

uPlot で3段構成の同期グラフを描画する。

| パネル | Y軸 | Y軸単位 | X軸 |
|--------|-----|---------|-----|
| 振幅特性 | ゲイン | dB | 周波数 [Hz]（対数） |
| 位相特性 | 位相 | 度 (°) | 周波数 [Hz]（対数） |
| 群遅延特性 | 群遅延 | 秒 (s) | 周波数 [Hz]（対数） |

### 4.2 軸設定

| 設定項目 | 値 |
|---------|-----|
| X軸スケール | log10 |
| X軸範囲 | 自動（データ範囲に基づく） |
| 振幅 Y軸範囲 | 自動、最小 -80dB |
| 位相 Y軸範囲 | -180° 〜 +180° |
| 群遅延 Y軸範囲 | 自動 |

### 4.3 インタラクション

- **カーソル同期**: 3パネル間でカーソルのX位置を同期
- **ツールチップ**: カーソル位置の周波数・ゲイン・位相・群遅延を表示
- **-3dBマーカー**: 振幅特性パネルに -3dB ポイントを丸マーカーで表示
- **ズーム**: マウスドラッグで範囲選択ズーム
- **リセット**: ダブルクリックで元の範囲に戻る

---

## 5. FR-4: 回路図表示

### 5.1 SVG コンポーネント設計

#### 部品シンボル

| コンポーネント | SVG 要素 | サイズ (viewBox) |
|--------------|---------|-----------------|
| `Resistor` | ジグザグ線 | 60 × 20 |
| `Capacitor` | 平行線 | 40 × 30 |
| `Inductor` | コイル（半円の連続） | 60 × 20 |
| `Ground` | 接地記号 | 20 × 20 |
| `Port` | 端子記号 | 20 × 20 |

#### レイアウトアルゴリズム

1. `components` 配列を走査し、直列素子（`series`）と並列素子（`shunt`）を交互に配置
2. 直列素子: 水平方向に接続線で結ぶ
3. 並列素子: グランドに向かって垂直方向に配置
4. 各素子の下に値ラベルを表示（適切な単位で自動フォーマット）
5. 左端にソースインピーダンス、右端に負荷インピーダンスを表示

#### 回路トポロジ別描画

| トポロジ | 構成 | 対象 |
|---------|------|------|
| ladder-t | 直列→並列→直列... (T型開始) | LPF/HPF/BPF/BEF |
| ladder-pi | 並列→直列→並列... (π型開始) | LPF/HPF/BPF/BEF |
| lattice | ブリッジ構成 | APF |

---

## 6. FR-5: BOM 表示

### 6.1 テーブル列定義

| 列名 | フィールド | 説明 |
|------|-----------|------|
| # | 行番号 | 連番 |
| 部品記号 | `component.id` | C1, L1, R1 等 |
| 種別 | `component.type` | コンデンサ / インダクタ / 抵抗 |
| 設計値 | `component.value` | 適切な単位で表示（自動フォーマット） |
| 配置 | `component.position` | 直列 / 並列 |

### 6.2 単位フォーマット

| 種別 | 基本単位 | フォーマット例 |
|------|---------|-------------|
| コンデンサ | F | 100 pF, 10 nF, 1 μF |
| インダクタ | H | 100 μH, 10 mH, 1 H |
| 抵抗 | Ω | 100 Ω, 10 kΩ, 1 MΩ |

### 6.3 CSV エクスポート

「CSV コピー」ボタンでクリップボードに以下の形式でコピーする:

```csv
部品記号,種別,設計値,配置
C1,コンデンサ,100 pF,並列
L1,インダクタ,10 mH,直列
C2,コンデンサ,47 nF,並列
```

---

## 7. 状態管理

### 7.1 アプリケーション状態

Context + useReducer パターンを使用する。

```typescript
interface AppState {
  // Pyodide 状態
  pyodideStatus: 'loading' | 'ready' | 'error';
  pyodideProgress: number;            // 0-100
  pyodideError?: string;

  // フィルタパラメータ
  filterParams: FilterParams;

  // 計算状態
  calculationStatus: 'idle' | 'calculating' | 'done' | 'error';
  calculationError?: FilterDesignError;

  // 計算結果
  result?: FilterResult;
}
```

### 7.2 状態遷移

```
[App 起動]
  → pyodideStatus: 'loading'
  → Worker 初期化開始
    → pyodideProgress: 0 → 100
    → pyodideStatus: 'ready' | 'error'

[ユーザー入力]
  → filterParams 更新
  → バリデーション実行
    → 成功: calculationStatus: 'calculating'
      → Worker にパラメータ送信
      → 結果受信: calculationStatus: 'done', result 更新
      → エラー: calculationStatus: 'error', calculationError 設定
    → 失敗: バリデーションエラー表示
```

---

## 8. エラーハンドリング

### 8.1 エラーカテゴリ

| コード | カテゴリ | 発生条件 | UI 表示 |
|--------|---------|----------|---------|
| `PYODIDE_LOAD_ERROR` | 初期化エラー | Pyodide / SciPy のロード失敗 | 全画面エラーメッセージ + リトライボタン |
| `INVALID_PARAMS` | パラメータエラー | バリデーション失敗 | 該当フィールドにインラインエラー |
| `CALCULATION_ERROR` | 計算エラー | SciPy の計算で例外発生 | メイン表示エリアにエラーメッセージ |

### 8.2 Pyodide 初期化エラーのリカバリ

1. エラーメッセージを表示（「計算エンジンの初期化に失敗しました」）
2. 「リトライ」ボタンを表示
3. ボタン押下で Worker を terminate → 新規 Worker 生成 → 再初期化
