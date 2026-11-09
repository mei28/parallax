# parallax の紹介動画で学ぶ Remotion

`video/` にある parallax の紹介動画（36 秒）を題材に、Remotion の使い方を説明する。
想定する読者は、React と TypeScript は書けるが Remotion は初めて、という開発者である。

前半の 1〜5 節で Remotion の基本を説明する。
6 節以降では、シーンを作った順に、使った技法と途中でつまずいた点を扱う。
引用したコードはすべて `video/src/` の実物から取り、節ごとにファイル名を添えた。

## 1. 動画をフレーム番号の関数として書く

Remotion では、動画を「フレーム番号を受け取って画面を返す React コンポーネント」として書く。
紹介動画は 30fps で 36 秒なので、フレームは 0 から 1079 までの 1080 枚ある。
書き出すとき、Remotion はフレームごとにコンポーネントを描画し、ヘッドレスの Chrome でその画面を撮影して、1080 枚の画像を MP4 にまとめる。

そのため、動きはすべてフレーム番号から計算する。
CSS の `transition` や `setTimeout` のように実時間で進む仕組みは使わない。
書き出しは 1 フレームずつ撮影し、しかも複数のタブで並列に進むので、実時間の経過とフレーム番号が対応しないからだ。

この書き方には、同じフレーム番号なら毎回同じ絵が出るという性質がある。
11 節で説明する確認方法（書き出した画像をバイト単位で比べる）は、この性質があるから成り立つ。

## 2. プロジェクトの構成とコマンド

`video/` は独自の `package.json` を持つ独立したプロジェクトである。
Remotion と React を拡張本体の依存から切り離すためで、拡張のビルドや `dist/` には影響しない。
ただし、ルートの biome は `video/src/` も対象にしているので、`just lint` は動画のコードも確認する。

```text
video/
├── package.json         remotion, @remotion/cli, @remotion/layout-utils, react
├── remotion.config.ts   CLI の設定（rspack を使う、JPEG で撮影する、出力を上書きする）
├── tsconfig.json
└── src/
    ├── index.ts         エントリポイント。registerRoot() を呼ぶだけ
    ├── Root.tsx         <Composition> の一覧
    ├── Promo.tsx        絵コンテ（シーンの順番と長さ）
    ├── timing.ts        FPS と seconds()
    ├── theme.ts         配色とフォント（ストア掲載画像と共通）
    ├── article.ts       記事の文章（store-assets/article.json）を読み込む
    ├── sync.ts          スクロール同期の計算（拡張のコードを呼ぶ）
    ├── components/      複数のシーンで使うコンポーネント
    └── scenes/          シーン 1 つにつき 1 ファイル
```

コマンドは `justfile` にまとめてある。

```sh
(cd video && pnpm install)     # 初回だけ
just video-studio              # Remotion Studio を開く
just video-still Promo 450     # 450 フレーム目を video/out/Promo-450.png に書き出す
just video-render Promo        # 動画全体を video/out/Promo.mp4 に書き出す
just video-typecheck           # video/ の型チェック
```

**Remotion Studio** は動画を編集しながら確認するためのブラウザ画面である。
左のサイドバーに動画の一覧が、下にタイムラインが並ぶ。
スペースキーで再生し、タイムラインをドラッグすると任意のフレームに移動できる。
ソースを保存すると、Studio の表示もすぐに更新される。

初回の書き出しでは、Remotion が撮影用の Chrome をダウンロードする。
Apple M2 のマシンで、36 秒の動画全体の書き出しに約 1 分かかった。

Remotion は、個人と従業員 3 人以下の組織なら商用でも無料で使える（[ライセンス](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)）。

## 3. `<Composition>` で動画の枠を決める

1 本の動画は `<Composition>` で定義する（`src/Root.tsx`）。

```tsx
export const RemotionRoot: FC = () => (
  <Composition
    id="Promo"
    component={Promo}
    durationInFrames={PROMO_DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
```

`id` は Studio のサイドバーに出る名前で、書き出すときの指定（`just video-render Promo`）にも使う。
`component` がフレームごとに描画される React コンポーネントである。
長さは秒ではなくフレーム数（`durationInFrames`）で指定する。
1920×1080 にしたのは、ストアが紹介動画を YouTube のプレーヤーで埋め込み、その比率が 16:9 だからである。

`<Composition>` を複数並べれば、1 つのプロジェクトで複数の動画を扱える。
開発の途中では、作りかけのシーンだけを別の `<Composition>` として登録して確認する使い方もできる。

## 4. 動きを作る基本の関数

### 今のフレーム番号を知る

`useCurrentFrame()` は今のフレーム番号を返す。
`useVideoConfig()` は `fps`、`width`、`height`、`durationInFrames` を返す。
この 2 つの値から、位置や透明度などをすべて計算する。

### `interpolate()` で値の範囲を写す

`interpolate(値, 入力の範囲, 出力の範囲)` はある範囲の値を別の範囲に写す。
ロゴの登場では、0 から 1 に進む値を、60px から 0px への移動量に写している。

```tsx
transform: `translateY(${interpolate(arrive, [0, 1], [60, 0])}px)`,
```

入力にフレーム番号を渡すときは、`extrapolateLeft` と `extrapolateRight` に `"clamp"` を指定する。
指定しないと、入力が範囲の外にあっても直線がそのまま延びるからだ。
たとえば 52〜62 フレームで透明度を 0 から 1 にする式は、clamp がなければ 62 フレーム以降に 1 を超え、52 フレームより前には負になる。

入力と出力に 3 つ以上の点を並べると、途中で止まる動きも書ける。
Sync シーンの読者のスクロールは、30〜95 フレームで 45% まで進み、115 フレームまで止まり、180 フレームで最後まで進む（`src/scenes/Sync.tsx`）。

```tsx
const READ = { frames: [30, 95, 115, 180], share: [0, 0.45, 0.45, 1] };

const read = interpolate(frame, READ.frames, READ.share, {
  easing: Easing.inOut(Easing.cubic),
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
```

`easing` を指定すると、区間ごとに加速と減速が付く。

### `spring()` でばねのように動かす

`spring()` はばねの物理計算で 0 から 1 に進む値を返す（`src/scenes/LogoIntro.tsx`）。

```tsx
const arrive = spring({ frame, fps, config: { damping: 200 } });
const drop = spring({ frame: frame - 16, fps, config: { damping: 9, mass: 0.7 } });
const open = spring({ frame: frame - 34, fps, config: { damping: 200 } });
```

`damping`（減衰）が大きいと行き過ぎずに止まり、小さいと 1 を行き過ぎてから戻る。
アイコンの右ペインが沈む動き（`drop`）は `damping: 9` で少し弾ませている。

開始を遅らせたいときは、`frame` から遅らせたいフレーム数を引いて渡す。
`frame - 16` なら、16 フレーム目から動き始める。

ばねが止まるまでの時間は、設定によって変わる。
次の動きを「ちょうど止まったとき」に始めたい場合は、`durationInFrames` を渡して長さを固定する（7 節）。

### `<AbsoluteFill>` で重ねる

`<AbsoluteFill>` は画面全体を覆う `position: absolute` の `div` である。
背景、シーン、ウィンドウなど、画面全体に重ねる層はこれで作る。

## 5. シーンを時間軸に並べる

### `<Series>` で順番に再生する

シーンは `<Series>` の中に `<Series.Sequence>` として並べると、前から順に再生される（`src/Promo.tsx`）。

```tsx
const SCENES = [
  { name: "LogoIntro", Scene: LogoIntro, duration: seconds(3) },
  { name: "Title", Scene: Title, duration: seconds(3) },
  { name: "Split", Scene: Split, duration: seconds(7) },
  { name: "Sync", Scene: Sync, duration: seconds(7) },
  { name: "Adjust", Scene: Adjust, duration: seconds(6) },
  { name: "Private", Scene: Private, duration: seconds(6) },
  { name: "Outro", Scene: Outro, duration: seconds(4) },
];

export const Promo: FC = () => (
  <Backdrop>
    <Series>
      {SCENES.map(({ name, Scene, duration }) => (
        <Series.Sequence key={name} name={name} durationInFrames={duration}>
          <Scene />
        </Series.Sequence>
      ))}
    </Series>
  </Backdrop>
);
```

`SCENES` の配列が、そのまま絵コンテになっている。
シーンを足すときは、この配列に 1 行足せばよい。
動画全体の長さ（`PROMO_DURATION`）も、この配列から計算している。
`name` に渡した名前は、Studio のタイムラインで各シーンの帯に表示される。

### Sequence の中ではフレーム番号が 0 から数え直される

`<Series.Sequence>` の中では、`useCurrentFrame()` はそのシーンの先頭を 0 として数えた番号を返す。
Split シーンは動画全体の 180 フレーム目から始まるが、Split の中では 0 から数える。
そのため、各シーンは動画のどこに置かれるかを知らずに書ける。

`useVideoConfig().durationInFrames` も同じで、Sequence の中ではそのシーン自身の長さを返す。
シーンの退場を作る `useExitStyle()` はこれを使い、どのシーンでも終わりの 12 フレームで上に抜けながら消えるようにしている（`src/components/Exit.tsx`）。

```tsx
const { durationInFrames } = useVideoConfig();
const out = interpolate(frame, [durationInFrames - EXIT_FRAMES, durationInFrames - 1], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.in(Easing.cubic),
});
```

### Sequence の外では動画全体のフレーム番号になる

背景の `<Backdrop>` は `<Series>` の外にあるので、`useCurrentFrame()` は動画全体のフレーム番号を返す。
背景の光はこの番号を使い、36 秒かけてゆっくり動く（`src/components/Backdrop.tsx`）。
シーンの切れ目をまたいでも途切れないのは、背景がどのシーンにも属していないからだ。

```tsx
const drift = interpolate(frame, [0, durationInFrames], [0, 10]);
```

### 退場の仕方はシーンごとに決める

退場は `Promo.tsx` で一律にかけず、各シーンが自分で決めている。
Split から Adjust までの 3 シーンは同じブラウザのウィンドウを使い続けるので、字幕だけを入れ替え、ウィンドウは次のシーンへ残したいからだ。

| シーン | 退場の仕方 |
|---|---|
| LogoIntro、Title、Private | 全体を `<Exit>` で包み、上に抜けながら消える |
| Split、Sync | 字幕だけが消え、ウィンドウは次のシーンに残る |
| Adjust | 字幕が消え、ウィンドウは下へ沈む |
| Outro | 退場しない（10 節） |

## 6. LogoIntro と Title

### アイコンを `div` 2 つで描く

アイコンは PNG ではなく、`div` 2 つで描いている（`src/components/Mark.tsx`）。
左右のペインを別々に動かし、右のペインだけを沈ませたいからだ。
寸法はアイコンの生成スクリプト（`store-assets/build_icons.py`）と同じ比率で、辺の長さに対する割合として書いた。
そのため、どの大きさで描いても拡張のアイコンと同じ形になる。

### 文字幅を測って中央を保つ

ロゴの「parallax」という文字は、幅 0 の箱が広がりながら現れる（`src/components/Lockup.tsx`）。
アイコンと文字を横に並べた行は常に画面の中央にあるので、文字の箱が広がるにつれて、アイコンは中央から左へ押し出される。
文字の箱を最初から全幅で置くと、アイコンは中央からずれた位置で文字を待つことになる。

箱の最終的な幅を知るために、`@remotion/layout-utils` の `measureText()` で文字の幅を測った。

```tsx
const NAME_WIDTH = measureText({ ...NAME, validateFontIsLoaded: true }).width;
```

`validateFontIsLoaded: true` を付けると、指定したフォントが見つからないときに、代わりのフォントで測らずにエラーで止まる。
フォントはストア掲載画像と同じシステムフォント（SF と Hiragino）なので、Mac 以外で書き出すとここで止まる。

### 単語を時間差で出す

Title シーンでは、見出しの単語を 3 フレームずつずらして浮かび上がらせている（`src/scenes/Title.tsx`）。

```tsx
const rise = spring({ frame: frame - word.order * STAGGER, fps, config: { damping: 200 } });
```

`order` は見出し全体を通した単語の番号で、改行をまたいでも数え直さない。
行ごとに数え直すと、2 行目の最初の単語が 1 行目の最初の単語と同時に出てしまう。

## 7. Split：ページを分割して片側を訳す

### コンポーネントは「そのフレームの状態」だけを受け取る

ブラウザの見た目は、次のコンポーネントに分けた。
Split、Sync、Adjust の 3 シーンがこれを使い回す。

| コンポーネント | 役割 | 受け取るもの |
|---|---|---|
| `Stage` | 上に字幕、下にウィンドウという配置 | 字幕、ウィンドウの登場と退場の有無 |
| `BrowserWindow` | 信号機の 3 つの丸とアドレスバー | 中身 |
| `SplitPanes` | 2 つのペインと仕切り | 左の幅の割合、分割の開き具合、上下か左右か |
| `Pane` | 記事 1 枚分 | どのブロックが日本語か、読み込みの進み具合、スクロール量 |

コンポーネントの側は、時間のことをほとんど知らない。
フレーム番号から数値を計算するのはシーンの役目で、コンポーネントは受け取った数値どおりに描く。
同じ `SplitPanes` に、Split シーンは「開いていく途中」の値を、Adjust シーンは「ドラッグ中」の値を渡している。

### 拍を名前付きの定数で書く

シーンの流れ（拍）は、ファイルの冒頭に名前付きの定数で書いた（`src/scenes/Split.tsx`）。

```tsx
const SPLIT_AT = 30;
const SPLIT_FRAMES = 24;
const LOAD_AT = SPLIT_AT + SPLIT_FRAMES;
const LOAD_FRAMES = 10;
const TRANSLATION: Translation = { start: LOAD_AT + LOAD_FRAMES + 8, stagger: 8 };
```

後ろの拍を前の拍から計算しているので、`SPLIT_AT` を 10 増やせば、読み込みも翻訳も 10 フレーム後ろへずれる。

分割が開く動きには、`spring()` に `durationInFrames: SPLIT_FRAMES` を渡している。
ばねの長さを固定したので、「開き切ったフレームで右ペインの読み込みを始める」という書き方ができる。

### 記事の文章を JSON から読む

記事の英文と和訳は `store-assets/article.json` にあり、ストア掲載画像の生成スクリプトと動画の両方がこのファイルを読む。
動画では `import` で読み込んでいる（`src/article.ts`）。
Remotion のバンドラは JSON の `import` に対応しているので、`video/` の外のファイルでも読める（`tsconfig.json` の `resolveJsonModule` を有効にする）。

読み込むときに、各ブロックの種類（`title`、`heading`、`paragraph`）が正しいかを確認する。
JSON に typo があれば、描画を始める前にエラーで止まる。

和訳はすべて Chrome の Translator API の実際の出力である。
拡張と同じく、fixture の段落のテキストノードを `trim()` した文字列を `translate()` に渡して取得した。
動画を作る途中で、元の 8 ブロックの和訳は人が整えた訳で、実際の出力ではなかったとわかった。
製品より整った訳を見せることになるので、全ブロックを実際の出力に揃え、掲載画像も描き直した。

### 翻訳の見せ方

日本語への切り替えは、ブロックの文字列を一度に差し替えている。
拡張の翻訳が要素を動かさず `Text.data` の代入だけで行われるのと同じ動きである。

差し替えたブロックには、水色の光とぼかしを一瞬重ね、どのブロックが今変わったのかを目で追えるようにした。
光の範囲は `boxShadow` の広がり（spread）で広げている。
`padding` で広げると、ブロックの高さが増えて下のブロックが押し下げられるからだ。

右のペインの中身は、ペインが開き切ってから現れる。
開いている途中のペインは幅が狭く、そこに文章を表示すると、1 語ずつ改行された文字が毎フレーム組み直される様子が見えてしまう。

## 8. Sync：スクロールを同期させる

### 拡張の計算をそのまま使う

スクロール同期の計算には、拡張の `src/shared/scroll.ts` にある `pickAnchor()` と `projectScrollTop()` をそのまま `import` した（`src/sync.ts`）。

```tsx
import { ANCHOR_LINE_FRACTION, ROOT_ANCHOR_ID } from "../../src/shared/constants.ts";
import { pickAnchor, projectScrollTop } from "../../src/shared/scroll.ts";
```

拡張の `src/shared/` は DOM も `chrome.*` も使わない純粋関数だけを置く場所である。
そのため、ブラウザ拡張の外にある動画のプロジェクトからでも呼べる。
拡張側の計算を変えれば、動画のペインの動きもそれに従う。

`src/shared/` の中では、`import` のパスに `.ts` の拡張子を付けている。
動画側の `tsconfig.json` でも `allowImportingTsExtensions` を有効にして、この書き方を受け付けるようにした。

### 測ってから描く

この計算には、各ブロックがページの上から何 px の位置にあり、高さが何 px かという値を渡す必要がある。
この値は文字の折り返し方で決まるので、実際に描画してから DOM を測るしかない。
そこで、Sync シーンは次の 2 段階で描く。

1. ペインをスクロールなしで一度描き、各ブロックの位置を測る。
2. 測った値から拡張と同じ計算でスクロール量を出し、描き直す。

1 段階目の絵がフレームとして書き出されては困る。
Remotion には、この待ち合わせのための `delayRender()` と `continueRender()` がある（`src/components/usePaneLayouts.ts`）。

```tsx
const [handle] = useState(() => delayRender("Measuring where the blocks sit in both panes"));
const [original, setOriginal] = useState<PaneLayout | null>(null);
const [translation, setTranslation] = useState<PaneLayout | null>(null);
useEffect(() => {
  if (isSized(original) && translation !== null) {
    continueRender(handle);
  }
}, [original, translation, handle]);
```

`delayRender()` を呼ぶと、Remotion はそのハンドルが `continueRender()` で解放されるまで撮影を待つ。
解放されないまま時間が過ぎると、書き出しはタイムアウトのエラーで止まる（12 節）。

位置は `offsetTop` と `offsetHeight` で測っている。
ページのスクロールは `transform` で動かしているので、`getBoundingClientRect()` で測ると、スクロール量を含んだ値になってしまう。
`offsetTop` と `offsetHeight` は `transform` の影響を受けないので、スクロールしても変わらないページ上の位置が取れる。

### シーンの切れ目で継ぎ目を見せない

Split の最後のフレームと Sync の最初のフレームは、ウィンドウの内側がピクセル単位で一致するように作った。
字幕だけが入れ替わり、ウィンドウは同じ画面が続いて見える。
そのために、次の点を揃えている。

- Sync は `Stage` に `windowEnters={false}` を渡し、ウィンドウを登場させない。
- 字幕の各行は 1 行に収め（`whiteSpace: "nowrap"`）、どのシーンでも字幕の高さを同じにする。字幕の行数が変わると、その下のウィンドウの位置もずれる。
- 拡張の計算では、スクロール 0 の位置でも右ペインが 7px ほどスクロールする。読み取り線の高さにあるブロックを、左右で同じ高さに揃えるためである。Split の最後では右ペインのスクロールは 0 なので、Sync の冒頭で読み取り線が現れるのに合わせて、右ペインを 0 から揃う位置まで滑らせた。
- 光り終わったブロックからは、光とぼかしのスタイルを外す。`filter: blur(0px)` が残っていると、文字の描画がごくわずか（輝度で 1 段階）変わっていた。

## 9. Adjust：仕切りをドラッグして向きを変える

### グリッドをやめて位置を計算する

最初の `SplitPanes` は CSS グリッドの列で左右のペインを並べていた。
しかしグリッドでは列を行に変えられないので、左右の分割と上下の分割を同じコンポーネントで扱えない。
そこで、各ペインの位置と大きさを自分で計算し、`position: absolute` で置く形に変えた（`src/components/SplitPanes.tsx`）。

```tsx
const along = (start: number, size: number, offset: number, extent: number): Box =>
  stacked
    ? { x: 0, y: start, w: 1, h: size, dx: 0, dy: offset, dw: 0, dh: extent }
    : { x: start, y: 0, w: size, h: 1, dx: offset, dy: 0, dw: extent, dh: 0 };
```

`x`、`y`、`w`、`h` は入れ物に対する割合、`dx`、`dy`、`dw`、`dh` は仕切りの太さ分のピクセルで、CSS では `calc(割合% + ピクセルpx)` になる。
割合の配分はグリッドの列と同じ式にしたので、書き換えの前後で左右のペインの位置と大きさは変わらない。
見た目が変わったのは仕切りのつまみだけで、これは以前からの不具合が直った分である（12 節）。

### 形の補間をやめて振り付けを変える

左右から上下への切り替えは、最初、2 つの配置の位置と大きさを直線的に混ぜて作ろうとした。
ところが途中のフレームで、仕切りが太い灰色の四角になり、ペイン同士も重なった。
細い縦の棒と細い横の棒の中間は、幅も高さも半分ずつの太い四角になるからだ。

そこで、動きのほうを変えた。
右のペインをいったん閉じて分割を解き、上下分割として下から開き直す。
閉じる途中の右ペインは幅が狭くなって文字が組み直されるので、中身は先に薄れさせる。
下から開くときは高さしか変わらず、文字の折り返しは変わらないので、中身を表示したままでよい。

### 毎フレーム測り直す

ドラッグ中は仕切りの位置が毎フレーム変わり、文字の折り返しもそのたびに変わる。
そこで `Pane` は描き直すたびに自分を測り、前回と値が違うときだけシーンに報告する（`src/components/Pane.tsx`）。

```tsx
const report = useCallback(() => {
  if (onLayout === undefined) {
    return;
  }
  const layout = measure(viewportRef.current, pageRef.current, columnRef.current);
  if (reportedRef.current !== null && sameLayout(reportedRef.current, layout)) {
    return;
  }
  reportedRef.current = layout;
  onLayout(layout);
}, [onLayout]);

useLayoutEffect(() => {
  report();
});
```

`useLayoutEffect` の中で親の状態を更新すると、React は画面に描く前に同期的に描き直す。
そのため、あるフレームを古い配置のまま描き、新しい配置の計算が次のフレームにずれ込む、ということが起きない。
値が変わったときだけ報告するのは、報告のたびに描き直しが起き、変わらない値を報告し続けると描き直しが止まらないからだ。

実際に、並列で書き出した MP4 のフレームと、そのフレームだけを単独で書き出した静止画は一致した（11 節）。

### ポインタを仕切りに乗せる

ドラッグするマウスポインタは、`SplitPanes` の `onHandle` に渡し、仕切りの中心に描かせている。
仕切りが動けばポインタも一緒に動くので、ポインタの位置を別に計算しなくて済む。

## 10. Private と Outro

### SVG の線を端から伸ばす

Private シーンでは、3 つのアイコン（鍵、電波、グラフ）に水色の斜線が引かれていく（`src/scenes/Private.tsx`）。

```tsx
strokeDasharray={STRIKE}
strokeDashoffset={STRIKE * (1 - strike)}
```

破線の間隔（`strokeDasharray`）を線の長さと同じにすると、線は「長さぶんの実線と、長さぶんの空白」の繰り返しになる。
このとき破線をずらす量（`strokeDashoffset`）を線の長さから 0 まで減らすと、空白が退いて実線が現れ、線が端から伸びていくように見える。

### 最後のフレームを残す

Outro だけは退場させていない（`src/scenes/Outro.tsx`）。
動画が止まると最後のフレームが画面に残るので、ロゴと利用条件が表示された状態で終わるようにした。
ロゴは LogoIntro と同じ `Lockup` コンポーネントを使い、組み上がる動きも同じにした。

## 11. 見た目の確かめ方

### 静止画を並べて一覧にする

動きの確認は Studio で再生するのがいちばん早い。
一方、特定のフレームを並べて比べたいときは、静止画に書き出して ffmpeg で 1 枚に並べると見やすい。

```sh
just video-still Promo 400
just video-still Promo 450

# 3 秒おきに 1 枚ずつ取り出し、3 列 4 行に並べる
ffmpeg -i video/out/Promo.mp4 -vf "fps=1/3,scale=640:-1,tile=3x4" -frames:v 1 overview.png
```

### リファクタリングの前後をバイト単位で比べる

1 節のとおり、同じフレーム番号なら毎回同じ絵が出る。
そのため、見た目を変えないはずの変更（コンポーネントの切り出しなど）は、前後で同じフレームを書き出して `cmp` で比べれば確かめられる。
この動画では、切り出しや構造の変更のたびに前後を比べ、すべてのフレームがバイト単位で一致することを確認した。

ただし、シーンを足して動画全体の長さが変わると、背景の光の位置が変わる（5 節）。
その場合はウィンドウの内側だけを切り出して比べる。

```sh
ffmpeg -i before.png -vf crop=1700:820:110:260 -f rawvideo -pix_fmt rgb24 - | shasum
ffmpeg -i after.png  -vf crop=1700:820:110:260 -f rawvideo -pix_fmt rgb24 - | shasum
```

シーンの切れ目も同じ方法で確かめた。
切れ目の直前と直後のフレームで、ウィンドウの内側が一致すれば継ぎ目は見えない。

### 並列の書き出しと単独の書き出しを比べる

毎フレーム測り直す Adjust シーンでは、並列で書き出したときに計測が遅れていないかを確かめた。
MP4 から取り出したフレームと、同じフレームを単独で書き出した静止画を、ffmpeg の PSNR（画像の近さを表す値。大きいほど近い）で比べる。

```sh
ffmpeg -i still.png -i from-mp4.png -lavfi psnr -f null -
```

同じフレーム同士は約 37dB で、これは MP4 の圧縮による差の大きさである。
別のフレーム同士を比べると約 15dB だったので、計測の遅れによる食い違いはないと判断した。

### 計測値を画面に描く

計測値の異常を調べるとき、今回の環境では `console.log` の出力が書き出しの端末に出てこなかった。
代わりに、値を JSON にして画面の上に一時的に描き、そのフレームを静止画で書き出して読んだ。

```tsx
<pre style={{ position: "absolute", left: 0, bottom: 0, background: "#ff0" }}>
  {JSON.stringify(layouts, null, 1)}
</pre>
```

## 12. つまずいた点と原因

| 症状 | 原因 | 対処 |
|---|---|---|
| Sync で左ペインが記事の終わりまで進みすぎ、右ペインが真っ白になる | 測った値がおかしかった（ペインの高さ 0、最初の段落の高さ 952px）。マウント直後は、コンポジションの入れ物がまだ最終的な大きさになっていないようだ | `ResizeObserver` で大きさが変わるたびに測り直し、原文ペインに高さが出てから `continueRender()` する |
| Adjust の書き出しが 28 秒で止まる（`delayRender` のタイムアウト） | 計測の完了を「両ペインの高さが 0 より大きい」で判定していた。上下に開き直す直前の右ペインは、意図して高さ 0 にしている | 判定を、常に表示されている原文ペインだけで行う |
| 左右から上下への切り替えの途中で、仕切りが太い灰色の四角になる | 細い縦の棒と細い横の棒を直線的に混ぜると、中間は太い四角になる | 閉じてから下から開き直す 2 段の動きに変える |
| Split から Sync への切れ目で、右ペインが 7px 跳ぶ | 拡張の計算では、スクロール 0 でも右ペインがわずかにスクロールする | 読み取り線が現れるのに合わせて、0 から揃う位置まで滑らせる |
| 同じ切れ目で、文字の輝度が 1 段階だけ違う | 光り終わったブロックに `filter: blur(0px)` などが残り、文字の描画がわずかに変わる | 光り終わったらスタイルを外す |
| 仕切りのつまみの右半分が欠ける | 仕切りの後に描かれる右ペインが、はみ出したつまみの上に重なる | 仕切りに `z-index` を付けて手前に置く。ストア掲載画像にも同じ不具合があり、あわせて直した |
| 見た目を変えていないのに、比較で差分が出る | 背景の光が、動画全体の長さに対する割合で動いている | ウィンドウの内側だけを切り出して比べる |

## 13. この先に試せること

音声を付けるなら、`@remotion/media` の `<Audio>` が現行の推奨である。
音声ファイルは `video/public/` に置き、`staticFile("bgm.mp3")` で参照する（[ドキュメント](https://www.remotion.dev/docs/audio)）。

シーンの切り替えに既製の効果を使うなら、`@remotion/transitions` の `<TransitionSeries>` がある（[ドキュメント](https://www.remotion.dev/docs/transitions/transitionseries)）。
切り替えの間は前後のシーンが重なって描かれるので、その分だけ動画全体が短くなる。
今回はウィンドウを次のシーンへ引き継ぎたかったので、使わずに各シーンの退場を自分で作った。

字幕を日本語にした版を作るなら、`<Composition>` の `defaultProps` で字幕の文言を外から渡せるようにする方法がある（[ドキュメント](https://www.remotion.dev/docs/parametrized-rendering)）。

## 付録：コミットで作った順に追う

この動画は次のコミットで少しずつ作った。
`git show <コミット>` で各段階の差分を見られる。

| コミット | 内容 |
|---|---|
| `f512c8d` | プロジェクトの作成、LogoIntro と Title |
| `2faa985` | 記事の文章を `store-assets/article.json` に切り出す |
| `1967865` | 退場の仕方を各シーンに任せる |
| `de6e38b` | Split と、ブラウザのコンポーネント |
| `884c011` | Sync、和訳を実際の Translator の出力に揃える |
| `1496ac3` | Adjust |
| `4546c32` | ストア掲載画像のつまみの修正 |
| `918135f` | Private と Outro |
