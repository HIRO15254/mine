# デザインの進め方（Claude Design）

Mine の見た目は、Claude Design のキャンバス「Mine UI」で決めてからコードに移します。キャンバスがデザインの正本で、コードはそれを写したものです。

- キャンバス: [Mine UI](https://claude.ai/artifact/1sijSnkLnkJyW1EoN2rSxR)
- デザインシステム: [Mine Design System](https://claude.ai/artifact/3pGCs5VhPg4RzKHCpyByXB)（キャンバスに入れてあります）。2026-11-06 に Cryst Design System から分けた Mine 専用のもので、アイコンの「黒地に光る白い結晶」に合わせて、白黒を基調に強調を「光る白」、プロジェクトの色をプリズムの 5 色にしています。キャンバスの「ブランド」ページに方針をまとめてあります

## 流れ

1. **キャンバスでデザインする。** Claude に「Mine UI の〇〇画面をこう変えたい」と頼むか、キャンバスを開いて直接いじります。新しい案は既存のボードを上書きせず、同じページに `-v2` などを付けた別ボードで作ると、あとで比べられます。
2. **実装を頼む。** このプロジェクトで「Mine UI の〇〇を実装に反映して」と頼みます。どのボードを反映するか言えば、そこだけを反映します。言わなければ、前回反映したとき以降に変わったボードをすべて反映します。
3. **Claude が実装する。** キャンバスを読み、前回反映した版との差分を見て、Mine Design System の部品でコードを直します。サンプルデータで画面写真を撮ってボードと見比べ、チェックとテストを通してから master に push します（push すると本番に出ます）。
4. **結果を見る。** 返信に変更前と変更後の画面写真が付きます。直したいところがあれば、キャンバスかスレッドで伝えてください。

## キャンバスの決まり

| 項目 | 決まり |
|---|---|
| ページ | ブランドと、画面ごと（今日・タスク・記録・カレンダー・設定・共通） |
| ボードの名前 | `<画面>.<desk か mobile>.dc.html`。状態違いは `<画面>-<状態>.<desk か mobile>.dc.html`（例: `tasks-empty.mobile.dc.html`） |
| 画面の名前 | `today` `tasks` `task-editor` `time` `calendar` `settings` `login`。画面写真の名前と同じ |
| 大きさ | desk は幅 1280px、mobile は 390×844px |
| 部品 | Mine Design System の部品（`window.Mine`）を使う。システムにはアプリが使う部品だけを置いている。ないものが要るときは、Cryst から取り込むか、メモに理由を書いて作る |
| メモ | 意図や「ここは仮」などは付箋で書く。実装するときに Claude が読みます |

ボードの中身は、コードと同じ部品・同じ文言にそろえます。サンプルの内容は画面写真のサンプルデータ（`apps/web/screens/fixtures.ts`）と同じものを使うと、見比べやすくなります。

## リポジトリの中の仕組み

| 場所 | 役目 |
|---|---|
| `design/canvas/` | 最後にコードへ反映したときのキャンバスの写し。次に反映するとき、ここと今のキャンバスの差分を見ます |
| `design/mine/tokens.css` | Mine Design System のトークンの写し |
| `design/sources.json` | キャンバスと Mine Design System の URL、写した版と日付（分ける前の Cryst の版も） |
| `bun run check:design-tokens` | アプリのトークン（`apps/web/src/index.css`）が Mine Design System の写しと合っているか確かめる。テストにも入っているので、ずれると CI とデプロイが止まります |
| `bun run screens` | サンプルデータで全画面の写真を撮る（`test-results/screens/`）。バックエンドもログインも要りません |
| `docs/design/exceptions.md` | デザインシステムの決まりから外れた箇所とその理由 |
| `.agents/skills/ui-design/SKILL.md` | Claude が上の流れをたどるための手順 |

### デザインシステムを変えたとき

Mine Design System の色や部品を変えたら、「デザインシステムの変更を Mine に反映して」と頼みます。Claude が `design/mine/tokens.css` を写し直し、`bun run check:design-tokens` が示すずれに合わせて `apps/web/src/index.css` を直します。部品の作りを変えたときは、`apps/web/src/components/ui/` の該当する部品を直します。

Cryst とは分かれたので、Cryst を直しても Mine には自動では入りません。Cryst の改善を取り込みたいときは「Cryst の〇〇を Mine Design System にも入れて」と頼んでください。

### 画面写真を自分の Mac で撮る

初回だけブラウザを入れます。

```sh
bunx playwright install chromium
bun run screens                                      # 全画面 × desk/mobile × dark/light
bun run screens -- --only tasks --viewport mobile    # 一部だけ
```

日時は 2026-11-10（火）14:20 に固定してあるので、何度撮っても同じ写真になります。
