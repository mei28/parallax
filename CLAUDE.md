# parallax — Chrome Extension

原文と訳文を同一タブ内で並べて読むための Chrome 拡張。同じ URL を指す同一オリジンの iframe を
2 枚並べ、片方の DOM を Chrome 組み込み Translator API（既定）か、ユーザ自身のキーで
Sarashina API（英日のみ）を使ってその場翻訳する。

## Conventions

- TypeScript strict mode。`any` 禁止（やむを得ない場合はコメントで理由）
- 公開関数には JSDoc、引数と返り値の型はすべて明示
- DOM API を直接叩くのは `src/content/*` 配下のみ。`src/shared/*` は pure function
  （DOM も `chrome.*` も参照しない）
- テストは AAA パターン（Arrange/Act/Assert）で書く
- `data-parallax-*` を DOM の名前空間として使用（CSS 変数: `--parallax-*`）
- フォールバックを書かない。失敗は名前の付いたエラーコードにして必ずユーザに見せる

## Commands

- `just build` — esbuild で production ビルド → dist/
- `just watch` — esbuild watch モード
- `just test` — vitest run
- `just lint` — biome check
- `just fmt` — biome check --write
- `just typecheck` — tsc --noEmit
- `just check` — lint + typecheck + test（コミット前のゲート）
- `just serve` — public/fixtures を配信（手動確認用）
- `just serve-blocked` — X-Frame-Options: DENY を付けて配信（FRAME_BLOCKED の確認用）

## Architecture

- `src/content/` — content script。DOM 操作はここだけ。Translator API もここで呼ぶ
  （service worker は worker コンテキストなので Translator を持たない）
- `src/background/` — service worker。storage と `scripting.executeScript` の橋渡しに加え、
  Sarashina への fetch を行う。API キーを読むのはここだけ（content script には渡さない）。
  host permission 付きの fetch で CORS を越える（Sarashina は ACAO を返さない）
- `src/popup/` — popup UI（翻訳エンジンの選択を含む）
- `src/options/` — オプションページ。Sarashina の API キー保存と `api.sarashina.ai` の
  host permission 要求（`permissions.request` は拡張ページからしか呼べない）
- `src/shared/` — pure function のみ（型、定数、分割の幾何計算、スクロール射影、失敗の記述）
- `src/chrome/` — `chrome.*` API の薄いアダプタ。`src/shared/` が純粋でいられるのはここがあるため
- `static/` — manifest.json, HTML, CSS, icons（ビルド時に dist/ へコピー）
- `test/` — vitest。`src/` をミラーする。jsdom はファイル先頭の
  `// @vitest-environment jsdom` で個別に有効化する

### ユーザに見える文字列

`chrome.i18n` で英語と日本語に対応する。カタログは `static/_locales/{en,ja}/messages.json`。
`src/shared/` は純粋なので `chrome.i18n` を呼べない。代わりに `MessageDescriptor`
（カタログのキーと置換値）を返し、`src/chrome/i18n.ts` の `renderMessage()` が文字列にする。

`test/shared/errors.test.ts` が、全エラーコードが全ロケールに存在し、置換値の個数が
カタログの placeholder 数と一致することを検証する。訳の抜けは空のバナーとして出るので、
テストで潰しておく。

### 崩してはいけない不変条件

翻訳は `Text.data` の代入のみを行い、要素の挿入・削除・移動をしない。
2 つの iframe の DOM 構造が一致していることがスクロール同期の対応付けの前提であり、
翻訳がこれを壊すと同期が壊れる。

Sarashina はブロック（段落）単位で訳す。訳文はブロック内の 1 ノードに入れ、残りのノードは
前後の空白だけを残して中身を空にする。空にするのも `Text.data` の代入なので、この不変条件は
保たれる。ノード単位で送ると断片が文にまとめられて対応が取れないことを、実 API で確かめてある。
