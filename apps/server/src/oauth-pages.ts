import type { PendingAuthorization } from "@mine/api/oauth";
import { base64url } from "@mine/api/tokens";

/**
 * The OAuth consent screen, rendered by the Worker so the sign-in and
 * session cookies stay first-party on the API's own domain.
 */

const ESCAPES: Record<string, string> = {
	'"': "&quot;",
	"&": "&amp;",
	"'": "&#39;",
	"<": "&lt;",
	">": "&gt;",
};
const SPECIAL = /[&<>"']/g;

export function escapeHtml(value: string): string {
	return value.replace(SPECIAL, (char) => ESCAPES[char] ?? char);
}

export const PAGE_HEADERS = {
	"Cache-Control": "no-store",
	"Content-Security-Policy":
		"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
	"Content-Type": "text/html; charset=utf-8",
	"Referrer-Policy": "no-referrer",
	"X-Frame-Options": "DENY",
};

const STYLE = `
:root { color-scheme: light dark; --bg: #f7f7f8; --card: #fff; --fg: #18181b; --muted: #71717a; --border: #e4e4e7; --primary: #18181b; --primary-fg: #fff; --danger: #b91c1c; }
@media (prefers-color-scheme: dark) { :root { --bg: #0b0b0d; --card: #17171a; --fg: #f4f4f5; --muted: #a1a1aa; --border: #2a2a30; --primary: #f4f4f5; --primary-fg: #18181b; --danger: #f87171; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100svh; display: flex; align-items: center; justify-content: center; padding: 32px 14px; background: var(--bg); color: var(--fg); font: 15px/1.6 "Noto Sans JP", system-ui, sans-serif; }
main { width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 20px; }
h1 { margin: 0; font-size: 28px; letter-spacing: -0.01em; }
section { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
h2 { margin: 0; font-size: 16px; }
p, ul { margin: 0; }
ul { padding-left: 20px; }
.muted { color: var(--muted); font-size: 13px; }
.error { color: var(--danger); }
code { font-family: "JetBrains Mono", ui-monospace, monospace; }
form { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
button { font: inherit; min-height: 44px; padding: 0 18px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--fg); cursor: pointer; }
button[value="allow"] { background: var(--primary); color: var(--primary-fg); border-color: var(--primary); }
`;

function page(title: string, body: string): string {
	return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} - Mine</title>
<style>${STYLE}</style>
</head>
<body><main><h1>Mine</h1>${body}</main></body>
</html>`;
}

export function errorPage(message: string): string {
	return page(
		"接続できません",
		`<section><h2>接続できません</h2><p class="error">${escapeHtml(message)}</p><p class="muted">Claude の画面に戻って、もう一度接続してください。</p></section>`
	);
}

const ABILITIES = [
	"タスクの確認・追加・変更・完了・削除",
	"タイマーの操作と記録の追加・集計",
	"プロジェクトとラベルの確認",
	"表示しているカレンダーの予定の確認",
	"Claude のスレッドの状況の記録",
];

export function consentPage(options: {
	clientName: string;
	csrf: string;
	email: string;
	request: PendingAuthorization;
}): string {
	const { clientName, csrf, email, request } = options;
	const name = escapeHtml(clientName);
	const fields: Record<string, string | undefined> = {
		client_id: request.clientId,
		code_challenge: request.codeChallenge,
		code_challenge_method: "S256",
		csrf,
		redirect_uri: request.redirectUri,
		response_type: "code",
		scope: request.scope,
		state: request.state,
	};
	const hidden = Object.entries(fields)
		.filter((entry): entry is [string, string] => Boolean(entry[1]))
		.map(
			([key, value]) =>
				`<input type="hidden" name="${key}" value="${escapeHtml(value)}">`
		)
		.join("");
	return page(
		`${clientName} を接続`,
		`<section>
<h2>${name} を接続</h2>
<p>許可すると、${name} が次のことをできるようになります。</p>
<ul>${ABILITIES.map((item) => `<li>${item}</li>`).join("")}</ul>
<p class="muted">アカウント: ${escapeHtml(email)}<br>戻り先: <code>${escapeHtml(new URL(request.redirectUri).host)}</code><br>接続は Mine の設定「Claude との接続」からいつでも解除できます。</p>
<form method="post" action="/oauth/authorize">${hidden}
<button type="submit" name="decision" value="deny">拒否</button>
<button type="submit" name="decision" value="allow">許可</button>
</form>
</section>`
	);
}

/**
 * Ties a consent form to the signed-in session and to this exact request,
 * so another site cannot post an approval on the user's behalf.
 */
export async function consentToken(
	secret: string,
	sessionId: string,
	request: PendingAuthorization
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ hash: "SHA-256", name: "HMAC" },
		false,
		["sign"]
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(
			JSON.stringify([
				"oauth-consent",
				sessionId,
				request.clientId,
				request.redirectUri,
				request.codeChallenge,
				request.state ?? "",
				request.scope ?? "",
			])
		)
	);
	return base64url(new Uint8Array(signature));
}
