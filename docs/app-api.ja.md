# 外部アプリ用 API

スマホのショートカットアプリなどから、タイマーを操作するための小さな JSON API です。

## トークン

設定画面の「APIトークン」でトークンを発行します。トークンは発行したときに一度だけ表示されるので、その場でコピーします。なくしたら削除して発行し直します。

すべてのリクエストに次のヘッダーを付けます。

```
Authorization: Bearer mine_xxxxxxxx…
```

この API はトークンだけを受け付けます（ブラウザのログイン状態では使えません）。トークンで操作できるのは記録やタスクなどで、トークン自体の発行と削除はブラウザからしかできません。

## エンドポイント

ベース URL は `<API の URL>/v1` です。本番では `https://api.mine.hiro15254.com/v1` です。

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/timer` | 計測中の記録 |
| POST | `/timer/start` | 計測を始める（計測中のものは止める） |
| POST | `/timer/stop` | 計測を止める |
| GET | `/projects` | プロジェクトの一覧 |

### GET /timer

```json
{
  "running": true,
  "description": "論文を読む",
  "project": "大学 / 研究",
  "startedAt": "2026-11-06T01:00:00.000Z",
  "elapsed": "0:42",
  "elapsedMinutes": 42,
  "text": "0:42 論文を読む（大学 / 研究）"
}
```

計測していないときは `running` が `false` で、`text` は「計測していません」です。`text` はそのまま通知やウィジェットに出せる1行です。

### POST /timer/start

本文（JSON）かクエリで、次を指定できます。どれも省略できます。

- `description`: 説明
- `project`: プロジェクト名か「大学 / 研究」のようなパス（アーカイブしたものは除く）
- `projectId`: プロジェクトの ID（`/projects` で確認）
- `taskId`: タスクの ID。説明とプロジェクトはタスクから補われます

返り値は `GET /timer` と同じ形です。知らないプロジェクト名を指定すると 400 になります。

### POST /timer/stop

```json
{ "stopped": true, "durationMinutes": 65, "text": "停止しました 1:05 論文を読む" }
```

計測していなかったときは `{ "stopped": false, "text": "計測していません" }` です。

## Android: HTTP Shortcuts での設定例

[HTTP Shortcuts](https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts)（無料）を使うと、ホーム画面のアイコンやウィジェットから操作できます。

1. **トークンを変数にする**: 「変数」で `mine_token` という定数の変数を作り、発行したトークンを入れます。
2. **ショートカットを作る**: 「＋」→「通常のショートカット」で、次の3つを作ります。
   - 計測状態: `GET https://api.mine.hiro15254.com/v1/timer`
   - 停止: `POST https://api.mine.hiro15254.com/v1/timer/stop`
   - 開始（よく使う作業ごとに）: `POST https://api.mine.hiro15254.com/v1/timer/start`、本文は JSON で `{"description": "論文を読む", "project": "大学 / 研究"}`
3. **ヘッダー**: どのショートカットにも `Authorization` ヘッダーを足し、値を `Bearer {mine_token}` にします（`{}` ボタンから変数を差し込みます）。
4. **結果の表示**: 「スクリプト」の「成功したときに実行」に次を入れると、返ってきた1行だけがトーストで出ます。
   ```js
   showToast(JSON.parse(response.body).text);
   ```
   「レスポンスの処理」は「表示しない」にします。
5. **ホーム画面に置く**: ショートカットを長押しして「ホーム画面に配置」、またはホーム画面のウィジェットから HTTP Shortcuts のウィジェットを置きます。

アプリの画面の項目名はバージョンによって少し違うことがあります。

## Tasker など

ほかのアプリでも、上のヘッダーを付けて同じ URL を呼べば使えます。Tasker なら「HTTP Request」アクションで `GET /timer` を呼び、`text` を通知に出せば、計測中の表示を常に出しておくこともできます。

## Claude から使う

Claude からは MCP で操作できます。設定方法は [claude-mcp.ja.md](claude-mcp.ja.md) を見てください。
