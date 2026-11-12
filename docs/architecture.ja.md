# 全体の構成

## パッケージ

```
apps/web      ブラウザの画面（React、PWA）
apps/server   Cloudflare Worker（Hono）。HTTP の入口と認証
packages/api  tRPC の手続き、REST と MCP の中身、OAuth サーバー
packages/auth Better Auth の設定と利用者の限定
packages/db   D1 の表の定義（Drizzle）と migration
packages/env  Web に公開する環境変数の検証
packages/config 共有の TypeScript 設定
```

依存の向きは `apps/web` と `apps/server` から `packages/api`、そこから `packages/db` への一方向です。`apps/web` が `packages/api` から使うのは、型と、ビューの判定のような純粋な関数だけです。

## 3 つの入口

同じデータに 3 つの入口があり、どれも最後は同じ tRPC の手続きを呼びます。入力の検証と「自分のデータだけ」の確認は手続きの中にあるので、入口ごとに書き直しません。

| 入口 | 使う人 | 認証 | 場所 |
|---|---|---|---|
| `/trpc` | Web アプリ | セッション cookie、または個人用 API トークン | `apps/server/src/worker.ts` と `packages/api/src/routers/` |
| `/v1` | ショートカットなどの外部アプリ | 個人用 API トークンだけ | `packages/api/src/rest/` |
| `/mcp` | Claude | Mine の OAuth のアクセストークン、または個人用 API トークン | `packages/api/src/mcp/` |

- cookie は `SameSite=None` なので、`/trpc` への書き込みは Web アプリの `Origin` が付いたものだけを受け付けます（別サイトのフォームからの送信を断るため）。
- OAuth のトークンは `/mcp` だけで使えます。同意画面が約束したのは MCP のツールだけだからです。
- トークンの発行と削除、接続したアプリの管理は、どのトークンからもできず、ブラウザのログインからだけです。
- MCP のツールは tRPC の手続きを呼びます。そのため、機能を足しても MCP のツールを足さない限り Claude からは使えません。

### 機能を足すときの順番

1. `packages/db` で表を変え、migration を作る（[手順](../packages/db/src/migrations/README.md)）。
2. `packages/api/src/routers/` に手続きとテストを書く。
3. `apps/web` に画面、フック、画面写真のサンプルデータを足す（[Web の手引き](../apps/web/AGENTS.md)）。
4. Claude から使うなら `packages/api/src/mcp/tools.ts` にツールを足し、[Claude から使う](./claude-mcp.ja.md) の表に書く。
5. ショートカットから使うなら `/v1` に足し、[外部アプリ用 API](./app-api.ja.md) に書く。
6. 決まりが変わったら [ドメインの決まり](./domain.ja.md) を直す。

## 認証

- ログインは Better Auth の Google ログインです。コールバックは API 側（`/api/auth/*`）で受けます。
- Google カレンダーは、ログインのときにもらった読み取り専用の権限で読みます。トークンの更新は Better Auth が行います。
- Claude の接続は Mine 自身の OAuth 2.1 サーバー（動的クライアント登録、PKCE、同意画面）です。同意画面は API 側が配信します。Web 側に置くと、cookie が届かないブラウザでログインが失敗するためです。

## Web アプリ

- 画面はファイルベースのルーティング（TanStack Router）で、`_app` の下がログイン後の画面です。
- データは TanStack Query で持ち、読み込んだものを 1 週間ブラウザに保存します。オフラインで開いたときは保存した内容を表示し、バナーで知らせます。
- 書き込みはオフラインでは待たずにすぐ失敗し、入力を戻してメッセージを出します。あとで送る仕組みは持ちません。
- タスクとタイマーの操作は、サーバーの返事を待たずに画面へ反映し、断られたら戻します。
- セッションの確認は「ログイン中」「ログアウト」「返事なし」を区別します。API が落ちているときは、最後の利用者と保存したデータで開きます。
- 新しい版が出ると、バナーで更新を勧めます。

## データベース

- Cloudflare D1（SQLite）です。対話的なトランザクションが無いので、まとめて行う書き込みは `db.batch([...])` にします。
- 2 つの依頼が同時に来ても壊れないよう、守りたい決まりは表の制約にします（計測中のタイマーは 1 つ、など）。

## デプロイ

`master` への push で、検査、migration、Worker、Web の順に本番へ出ます。詳しくは [デプロイと運用](./deploy.ja.md) を見てください。
