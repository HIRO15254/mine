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

Web（Pages）と API（Worker）は別ドメインなので、セッション cookie は `SameSite=None; Secure` のサードパーティ cookie になります。Safari などで弾かれる場合は、両方を同じ独自ドメインのサブドメインに置いてください。

## 本番

`master`へのpushでCI、D1 migration、Worker deploy、Pages build/deployの順に実行します。本番D1 UUIDがplaceholderのままならdeployは停止します。

migration は `packages/db/src/migrations` にあり、deploy 前に本番 D1 へ適用されます。

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
