# Mine

予定・タスク・時間の記録をひとつにまとめる、自分用のダッシュボードです。PC ではサイドバー、スマホではボトムタブで使えるレスポンシブな PWA で、UI は Cryst Design System に沿っています。

[English](./README.md)

## 構成

- `apps/web`: React 19、Vite、TanStack Router/Query、tRPC、Tailwind CSS、Cryst のコンポーネント（shadcn/ui の名前と Radix UI）
- `apps/server`: Cloudflare Workers 上の Hono。tRPC と Better Auth を配信
- `packages/api`: tRPC の手続き
- `packages/auth`: Better Auth（Google ログイン、`ALLOWED_EMAILS` による利用者の限定）
- `packages/db`: Cloudflare D1 の Drizzle schema と migration

設計の全体像と今後の段階は設計資料を参照してください。

## 開発

```sh
bun install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
cp apps/server/.dev.vars.example apps/server/.dev.vars   # Google の OAuth クライアントなどを記入
bun run db:migrate:local
bun run dev
```

Web は `http://localhost:3001`、API は `http://localhost:8787` で起動します。

主要な検査コマンド:

```sh
bun run check-types
bun run check
bun run test
bun run check:test-discovery
bun run build
```

Cloudflare と Google ログインの初期設定は[デプロイガイド](./docs/deploy.ja.md)を参照してください。

画面のデザインは Claude Design のキャンバスで決めてから実装します。進め方は[デザインの進め方](./docs/design-workflow.ja.md)を参照してください。
