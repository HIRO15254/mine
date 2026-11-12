# デプロイと運用

## 初回セットアップ

アプリケーションを稼働させるCloudflare accountに次のリソースを作成します。

1. `mine-db`という本番D1 database
2. `mine`というPages project
3. `mine-api`というWorker API（最初の本番deployで作成しても構いません）

本番D1 UUIDを`apps/server/wrangler.jsonc`の`d1_databases[0].database_id`へ設定します。GitHub repository variablesに次を設定します。

- `CLOUDFLARE_ACCOUNT_ID`
- `PRODUCTION_WEB_URL`（CORSで許可する完全一致のorigin）
- `PRODUCTION_API_URL`（Web buildへ埋め込むWorker base URL）

GitHub Actions secretとして`CLOUDFLARE_API_TOKEN`を設定します。tokenにはWorkers Scripts、Pages、D1を管理するために必要なaccount権限が必要です。

コマンドラインで用意する場合は次のとおりです。既にあるリソースを二重に作らないよう、先に一覧で確かめます。secret は対話入力にして、shell の履歴に残さないようにします。

```sh
bunx wrangler d1 list
bunx wrangler pages project list
bunx wrangler d1 create mine-db
bunx wrangler pages project create mine --production-branch master

gh variable set CLOUDFLARE_ACCOUNT_ID --body "<account-id>"
gh variable set PRODUCTION_WEB_URL --body "<web-origin>"
gh variable set PRODUCTION_API_URL --body "<worker-base-url>"
gh secret set CLOUDFLARE_API_TOKEN
```

`wrangler.jsonc`を変更した後は`bun run cf:typegen`を実行し、生成されたbinding型をcommitします。

## 認証（Google ログイン）

ログインは Better Auth の Google ログインだけで、`ALLOWED_EMAILS` に載っているメールアドレス以外はアカウントを作成できません。空のままだと誰もログインできません。

1. Google Cloud Console で OAuth クライアント（ウェブアプリケーション）を作成し、承認済みのリダイレクト URI に次を登録します。
   - ローカル: `http://localhost:8787/api/auth/callback/google`
   - 本番: `<PRODUCTION_API_URL>/api/auth/callback/google`
2. OAuth 同意画面の公開ステータスを「本番」にします。「テスト」のままだと、カレンダー連携に使うリフレッシュトークンが7日で失効します。
   - 同じプロジェクトで「Google Calendar API」を有効にします（API とサービス → ライブラリ）。
   - ログイン時に `https://www.googleapis.com/auth/calendar.readonly`（カレンダーの閲覧）とオフラインアクセスを要求します。審査を受けていないアプリなので、同意画面に「Google はこのアプリを確認していません」と出ます。自分専用なら「詳細」から続行して構いません。
   - スコープを追加する前にログインしていた場合は、アプリの「カレンダーを連携」から一度ログインし直すと権限が付きます。
3. 本番 Worker に secret を設定します（deploy をまたいで保持されます）。

   ```sh
   cd apps/server
   bunx wrangler secret put BETTER_AUTH_SECRET    # openssl rand -base64 32 などで生成
   bunx wrangler secret put GOOGLE_CLIENT_ID
   bunx wrangler secret put GOOGLE_CLIENT_SECRET
   bunx wrangler secret put ALLOWED_EMAILS        # カンマ区切り
   ```

`BETTER_AUTH_URL` は deploy 時に `PRODUCTION_API_URL` から自動で設定されます。ローカルでは `apps/server/.dev.vars.example` を `.dev.vars` にコピーして値を入れます。

セッション cookie は `SameSite=None; Secure` で発行します。本番は Web が `mine.hiro15254.com`、API が `api.mine.hiro15254.com` で、同じ独自ドメインのサブドメインなので、ブラウザのサードパーティ cookie の制限には当たりません。`pages.dev` と `workers.dev` のままで使うと別サイトになり、Safari などでログインが保てません。

## 本番

`master` への push で、GitHub Actions の Production Deploy が次の順に実行します。前の段が失敗すると、後ろの段は実行しません。

1. 検査（`bun run verify`）
2. D1 の migration（`packages/db/src/migrations`）
3. Worker（API）の deploy
4. Web の build と Pages への deploy

同じ検査を pre-push フックでも実行するので、手元で通らない変更は push できません。実行の結果は GitHub の Actions の画面で確かめます。

### 途中で止まったとき

| 止まった段 | 本番の状態 | すること |
|---|---|---|
| 検査 | 何も変わっていない | 原因を直して push し直す |
| migration | 表が途中まで変わっていることがある。Worker と Web は前のまま | 適用済みの migration は書き換えず、直す migration を足して push する。`bunx wrangler d1 migrations list DB --remote -c apps/server/wrangler.jsonc` で未適用のものを確かめられる |
| Worker | 表は新しく、Worker と Web は前のまま | 原因を直して push し直すか、Actions の画面から実行し直す |
| Web | 表と Worker は新しく、Web は前のまま | 同上。Web だけなら、下の「手動でデプロイする」の最後の 2 行でも出せる |

migration は Worker より先に出るので、「前の Worker でも動く変更」にしておく決まりです（列や表を足すのが先で、消すのは次の push）。これを守っていれば、途中で止まっても本番は動き続けます。

### 元に戻す

- コードを戻すときは、戻すコミット（`git revert`）を push します。履歴を書き換える push はしません。
- Worker だけを急いで戻すときは、`apps/server` で `bunx wrangler rollback` を実行すると 1 つ前の版に戻ります。そのあと、コードも戻すコミットを push して `master` と本番をそろえます。
- 表の変更は自動では戻りません。戻す必要があるときは、戻すための migration を足します。データは D1 の Time Travel（`bunx wrangler d1 time-travel restore DB -c apps/server/wrangler.jsonc --timestamp <時刻>`）で過去 30 日以内の時点に戻せますが、その時点より後の書き込みは失われます。

### secret と設定を変えるとき

- Worker の secret は `apps/server` で `bunx wrangler secret put <名前>` を実行して入れ替えます。deploy をまたいで保持されます。
- 利用者を足すときは `ALLOWED_EMAILS` を入れ替えます。一覧から外したメールアドレスは、ログイン中でも発行済みのトークンがあっても、すぐに使えなくなります。
- URL を変えるときは、GitHub の variables（`PRODUCTION_WEB_URL` と `PRODUCTION_API_URL`）と、Google の OAuth クライアントのリダイレクト URI を両方直します。

## 手動でデプロイする

ふだんは `master` への push に任せます。GitHub Actions を使えないときだけ、同じ順番を手で行います。

```sh
bun run verify
bun run db:migrate:remote

cd apps/server
bunx wrangler deploy --var "CORS_ORIGIN:<PRODUCTION_WEB_URL>" --var "BETTER_AUTH_URL:<PRODUCTION_API_URL>"
cd ../..

VITE_SERVER_URL="<PRODUCTION_API_URL>" bun run --filter @mine/web build
bunx wrangler pages deploy apps/web/dist --project-name mine --branch master
```

## ローカル受け入れ検査

```sh
bun install --frozen-lockfile
bun run verify
bun run db:migrate:local
```
