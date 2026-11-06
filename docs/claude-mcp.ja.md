# Claude から使う（MCP）

Mine は MCP サーバーを持っているので、Claude（Web・デスクトップ・Android/iOS アプリ・Claude Code）からタスクやタイマーを操作できます。音声入力で話しかければ、そのままタスクを追加できます。

MCP の URL: `https://api.mine.hiro15254.com/mcp`

## できること

| ツール | 内容 |
|---|---|
| `list_tasks` | タスクを見る（今日・近日・インボックス・すべて、プロジェクトや文字で絞り込み） |
| `add_task` | タスクを追加（プロジェクト、ラベル、優先度、最速実行可能日・予定日・締め切り、繰り返し） |
| `update_task` | タスクを変更 |
| `complete_task` | タスクを完了（繰り返しは次の回へ） |
| `delete_task` | タスクを削除 |
| `list_projects` | プロジェクトとラベルの一覧 |
| `get_timer` / `start_timer` / `stop_timer` | タイマー |
| `add_time_entry` | あとから記録を追加 |
| `time_report` | 期間の記録をプロジェクト別・日別に集計（金額つき） |
| `list_events` | Google カレンダーの予定を見る（読むだけ） |
| `report_thread_status` | その会話の状況（作業中・あなた待ち・完了）を Mine に記録 |
| `list_threads` | 記録されたスレッドの一覧 |

日付は日本時間で扱います。

## Claude（Web・アプリ）に接続する

1. claude.ai の「設定」→「コネクタ」→「カスタムコネクタを追加」を開きます。
2. 名前を `Mine`、URL を上の MCP の URL にして追加します。
3. 「連携/接続」を押すと Mine の確認画面が開きます。ログインしていなければ Google でログインし、「許可」を押します。
4. 会話の「＋」→ コネクタで Mine をオンにして使います。

Web で追加したコネクタは Android アプリでも使えます。項目名は Claude のバージョンで少し違うことがあります。

接続を切るときは、Mine の「設定」→「Claude との接続」で削除します。

### 話しかけ方の例

- 「明日までにレポートを出す、を大学のタスクに追加して。優先度 1 で」
- 「今日のタスクを教えて」
- 「論文を読むの計測を始めて」「タイマー止めて」
- 「今週どのプロジェクトに何時間使った？」
- 「昨日 10 時から 2 時間、研究をしていたことにして」

## Claude のスレッドを Mine で見る

Mine をつないだ Claude は、長めの作業をするときに `report_thread_status` でその会話の状況を Mine に記録します。記録したスレッドは「今日」の「Claude のスレッド」に出ます。

- 「あなた待ち」のものが上に来て、何をすればよいかが表示されます
- 会話の URL がわかっている場合（Claude Code のセッションなど）は、タイトルから開けます
- チェックのボタンで完了にすると一覧から消えます

自動で記録されないときは、「この会話の状況を Mine に記録して」と頼んでください。

## Claude Code から使う

OAuth でつなぐ場合:

```sh
claude mcp add --transport http mine https://api.mine.hiro15254.com/mcp
```

追加したあと Claude Code で `/mcp` を開き、Mine を選んで認証します（ブラウザで確認画面が開きます）。

API トークン（設定の「APIトークン」で発行）を使う場合は、ヘッダーで渡せます。

```sh
claude mcp add --transport http mine https://api.mine.hiro15254.com/mcp \
  --header "Authorization: Bearer <発行したトークン>"
```

## しくみ（メモ）

- 認証は OAuth 2.1（動的クライアント登録、PKCE は S256 のみ）。確認画面は API の `/oauth/authorize` が出します。Web アプリとはドメインが違うので、ログインの Cookie がドメインをまたがないよう API 側に置いています。
- 戻り先として登録できるのは Claude のコールバック（`https://claude.ai/api/mcp/auth_callback` と `https://claude.com/api/mcp/auth_callback`）と、手元の `localhost` だけです。
- アクセストークンは 1 時間、リフレッシュトークンは 90 日で切れ、使うたびに入れ替わります。どれもハッシュだけを保存しています。
- MCP のトークンでは API トークンの発行や接続の許可はできません（ブラウザでのみ）。
