# parallax — Chrome Extension

原文と訳文を同一タブ内で並べて読むための Chrome 拡張。同じ URL を指す同一オリジンの iframe を
2 枚並べ、片方の DOM を Chrome 組み込み Translator API でその場翻訳する。

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
- `src/background/` — service worker。storage と `scripting.executeScript` の橋渡しのみ
- `src/popup/` — popup UI
- `src/shared/` — pure function のみ（型、定数、分割の幾何計算、スクロール射影、エラー文言）
- `static/` — manifest.json, HTML, CSS, icons（ビルド時に dist/ へコピー）
- `test/` — vitest。`src/` をミラーする。jsdom はファイル先頭の
  `// @vitest-environment jsdom` で個別に有効化する

### 崩してはいけない不変条件

翻訳は `Text.data` の代入のみを行い、要素の挿入・削除・移動をしない。
2 つの iframe の DOM 構造が一致していることがスクロール同期の対応付けの前提であり、
翻訳がこれを壊すと同期が壊れる。
