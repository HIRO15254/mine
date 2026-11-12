# Mine

予定・タスク・時間の記録をひとつにまとめる、自分用のダッシュボードです。PC ではサイドバー、スマホではボトムタブで使えるレスポンシブな PWA で、UI は Mine Design System（Cryst から分けた Mine 専用のもの）に沿っています。予定は Google カレンダーを正とし、タスクと時間の記録は Cloudflare D1 に置きます。

## 構成

- `apps/web`: React 19、Vite、TanStack Router/Query、tRPC、Tailwind CSS、Mine Design System のコンポーネント（shadcn/ui の名前と Radix UI）
- `apps/server`: Cloudflare Workers 上の Hono。Web 用の tRPC、Better Auth、外部アプリ用の REST API（`/v1`）、Claude 用の MCP サーバー（`/mcp`）を配信
- `packages/api`: tRPC の手続きと、REST API・MCP ツールの中身
- `packages/auth`: Better Auth（Google ログイン、`ALLOWED_EMAILS` による利用者の限定）
- `packages/db`: Cloudflare D1 の Drizzle schema と migration
- `packages/env`: Web に公開する環境変数の検証
- `packages/config`: 共有の TypeScript 設定

## 開発

```sh
bun install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
cp apps/server/.dev.vars.example apps/server/.dev.vars   # Google の OAuth クライアントなどを記入
bun run db:migrate:local
bun run dev
```

Web は `http://localhost:3001`、API は `http://localhost:8787` で起動します。

検査は次のひとつにまとまっています。

```sh
bun run verify
```

`verify` は本番デプロイの前に走る検査（バインディングの型、型チェック、lint、テストの振り分け、カバレッジ付きテスト、両方のビルド）をまとめて実行します。`master` への push は本番デプロイになるため、pre-push フックでも同じものが走ります。

## ドキュメント

- [デプロイと運用](./docs/deploy.ja.md): Cloudflare と Google ログインの初期設定、本番への出し方
- [デザインの進め方](./docs/design-workflow.ja.md): Claude Design のキャンバスで画面を決めてから実装する流れ
- [外部アプリ用 API](./docs/app-api.ja.md): 個人用 API トークンで使う `/v1`
- [Claude から使う](./docs/claude-mcp.ja.md): MCP サーバー `/mcp` の接続方法
- [AGENTS.md](./AGENTS.md): コーディングエージェント向けの手引き（英語）
