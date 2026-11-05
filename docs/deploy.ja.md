# Cloudflareデプロイ

## 初回セットアップ

アプリケーションを稼働させるCloudflare accountに次のリソースを作成します。

1. `mine-db`という本番D1 database
2. `mine`というPages project
3. `mine-api`というWorker API（最初の本番deployで作成しても構いません）

本番D1 UUIDを`apps/server/wrangler.jsonc`へ設定します。deploy可能な派生プロジェクトでは、全ゼロのplaceholderをcommitしないでください。GitHub repository variablesに次を設定します。

- `CLOUDFLARE_ACCOUNT_ID`
- `PRODUCTION_WEB_URL`（CORSで許可する完全一致のorigin）
- `PRODUCTION_API_URL`（Web buildへ埋め込むWorker base URL）

GitHub Actions secretとして`CLOUDFLARE_API_TOKEN`を設定します。tokenにはWorkers Scripts、Pages、D1を管理するために必要なaccount権限が必要です。

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

Web（Pages）と API（Worker）は別ドメインなので、セッション cookie は `SameSite=None; Secure` のサードパーティ cookie になります。Safari などで弾かれる場合は、両方を同じ独自ドメインのサブドメインに置いてください。PR preview の Worker には secret が無いため、preview ではログインできません。

## 本番

`master`へのpushでCI、D1 migration、Worker deploy、Pages build/deployの順に実行します。本番D1 UUIDがplaceholderのままならdeployは停止します。

migration は `packages/db/src/migrations` にあり、deploy 前に本番 D1 へ適用されます。

## Pull request preview

同一リポジトリ内のbranchから作成したPRには、PRごとに安定した次のリソースを作成します。

- Worker: `<slug>-api-pr-<number>`
- Pages deployment: `<slug>` project内の`pr-<number>` branch
- D1 database: `<slug>-db-pr-<number>`

fork PRではpreviewを作成しません。repository secretを利用できず、信頼していないcodeへ本番dataを渡さないためです。

PR databaseを初めて作成したとき、本番適用済みmigrationまでschemaを揃え、本番D1の全dataをexportし、triggerを一時的に外してからimportし、必ずtriggerを復元した後にPR branchだけの新しいmigrationを適用します。空schema、migrationなし、空dumpはいずれも正常系です。以後のpushでは同じpreview databaseを再利用し、未適用migrationだけを追加適用します。PR close時はWorker、Pages deployment、D1 databaseを冪等に削除します。

> **データ公開範囲の警告:** 最初のpreview snapshotは、匿名化していない本番D1の完全な複製です。このリポジトリへbranchを作成できる全員を、本番dataへアクセス可能な信頼済み利用者として扱うことになります。この前提が合わない場合は、preview deployを有効にする前にsnapshot手順を無効化するか、匿名化したfixture生成へ置き換えてください。

export中はsource D1への他のrequestが一時的にblockされるため、大規模snapshotの実行時刻には注意してください。

## ローカル受け入れ検査

```sh
bun install --frozen-lockfile
bun run cf:typegen:check
bun run check-types
bun run check
bun run test:ci
bun run test:coverage
bun run check:test-discovery
bun run build
bunx wrangler deploy --dry-run -c apps/server/wrangler.jsonc
bun run db:migrate:local
```
