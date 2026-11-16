import type { WidgetSnapshot } from "@mine/api/rest/widget";

import { escapeHtml } from "./oauth-pages";

/**
 * The home-screen widget page: one small screen drawn on the server, for
 * Android apps that show a web page as a widget (they take a picture of it
 * now and then, often without running scripts). So: no scripts, no fonts or
 * images to fetch, and everything legible at a few hundred pixels wide. The
 * colors are the Mine Design System's tokens, copied from `apps/web`.
 */

export type WidgetTheme = "auto" | "dark" | "light";

export const WIDGET_HEADERS = {
	"Cache-Control": "no-store",
	"Content-Security-Policy":
		"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
	"Content-Type": "text/html; charset=utf-8",
	// The secret is in the address; never send it on.
	"Referrer-Policy": "no-referrer",
	"X-Robots-Tag": "noindex",
};

const LIGHT =
	"--bg: #f6f7f9; --card: #ffffff; --fg: #14161a; --muted: #5c6370; --subtle: #858b96; --border: #e1e4e9; --soft: rgba(20, 22, 26, 0.05); --glow: 0 0 0 1px rgba(20, 22, 26, 0.08), 0 6px 18px rgba(20, 22, 26, 0.07); --glow-text: none; --danger: #c33037; --warning: #a05000; --chart-1: #2f6fe0; --chart-2: #0c8a63; --chart-3: #b06a00; --chart-4: #c8434f; --chart-5: #7a52d6;";
const DARK =
	"--bg: #060709; --card: #0d0f13; --fg: #eef1f5; --muted: #98a0ad; --subtle: #6f7682; --border: #20232a; --soft: rgba(230, 236, 245, 0.06); --glow: 0 0 0 1px rgba(220, 230, 245, 0.14), 0 0 22px rgba(200, 215, 240, 0.12); --glow-text: 0 0 12px rgba(220, 232, 250, 0.45); --danger: #ff6b70; --warning: #f5a65b; --chart-1: #8fb4ff; --chart-2: #6fd1b0; --chart-3: #efb36d; --chart-4: #f2828c; --chart-5: #b49cff;";

function themeCss(theme: WidgetTheme): string {
	if (theme === "light") {
		return `:root { color-scheme: light; ${LIGHT} }`;
	}
	if (theme === "dark") {
		return `:root { color-scheme: dark; ${DARK} }`;
	}
	return `:root { color-scheme: light dark; ${LIGHT} }
@media (prefers-color-scheme: dark) { :root { ${DARK} } }`;
}

const STYLE = `
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { background: var(--bg); color: var(--fg); font: 14px/1.4 "Noto Sans JP", system-ui, -apple-system, "Hiragino Sans", sans-serif; letter-spacing: -0.005em; overflow: hidden; }
main { height: 100%; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
h1 { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.015em; }
.stamp { color: var(--subtle); font-size: 11px; white-space: nowrap; }
.mono { font-family: "JetBrains Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.timer { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; background: var(--card); border: 1px solid var(--border); }
.timer.live { box-shadow: var(--glow); border-color: transparent; }
.timer .elapsed { font-size: 20px; font-weight: 600; text-shadow: var(--glow-text); }
.timer .what { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.timer .idle { color: var(--muted); }
.columns { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
section { min-height: 0; display: flex; flex-direction: column; gap: 2px; }
h2 { margin: 0 0 2px; color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; }
ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; }
li { display: flex; align-items: center; gap: 8px; min-width: 0; }
.title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.time { color: var(--muted); font-size: 12px; white-space: nowrap; min-width: 82px; }
.now .title { font-weight: 600; }
.now .time { color: var(--fg); }
.bar { width: 3px; align-self: stretch; min-height: 16px; border-radius: 2px; background: var(--subtle); flex: none; }
.ring { width: 13px; height: 13px; border-radius: 50%; border: 1.5px solid var(--subtle); flex: none; }
.p1 { border-color: var(--danger); }
.p2 { border-color: var(--warning); }
.p3 { border-color: var(--fg); }
.dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.late { color: var(--danger); }
.empty { color: var(--subtle); font-size: 12px; }
@media (min-width: 520px) { .columns { flex-direction: row; } .columns > section { flex: 1; } }
`;

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const COLORS = new Set(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]);
const HEX = /^#[0-9a-f]{3,8}$/i;

/** "11月16日（月）" */
function dayHeading(day: string): string {
	const [year, month, date] = day.split("-").map(Number);
	const weekday = new Date(
		Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1)
	).getUTCDay();
	return `${month}月${date}日（${WEEKDAYS[weekday]}）`;
}

function projectDot(color: string | null): string {
	return color && COLORS.has(color)
		? `<span class="dot" style="background: var(--${color})"></span>`
		: "";
}

function timerBlock(timer: WidgetSnapshot["timer"]): string {
	if (!timer) {
		return `<div class="timer"><span class="idle">計測していません</span></div>`;
	}
	const project = timer.project
		? `<span class="sub">${projectDot(timer.projectColor)} ${escapeHtml(timer.project)}・${timer.startedAt} から</span>`
		: `<span class="sub">${timer.startedAt} から</span>`;
	return `<div class="timer live"><span class="elapsed mono">${timer.elapsed}</span><span class="what"><span class="title">${escapeHtml(timer.description ?? "説明なし")}</span>${project}</span></div>`;
}

function eventList(events: WidgetSnapshot["events"]): string {
	if (events === null) {
		return `<p class="empty">カレンダーを読み込めませんでした</p>`;
	}
	if (events.length === 0) {
		return `<p class="empty">今日の残りの予定はありません</p>`;
	}
	const rows = events.map((event) => {
		const color =
			event.color && HEX.test(event.color)
				? ` style="background: ${event.color}"`
				: "";
		const time = event.allDay ? "終日" : `${event.start}–${event.end}`;
		return `<li class="${event.current && !event.allDay ? "now" : ""}"><span class="bar"${color}></span><span class="time mono">${time}</span><span class="title">${escapeHtml(event.title)}</span></li>`;
	});
	return `<ul>${rows.join("")}</ul>`;
}

function taskList(tasks: WidgetSnapshot["tasks"], more: number): string {
	if (tasks.length === 0) {
		return `<p class="empty">今日のタスクはありません</p>`;
	}
	const rows = tasks.map((task) => {
		const meta = [
			task.time ? `<span class="sub mono">${task.time}</span>` : "",
			task.overdue ? `<span class="sub late">期限切れ</span>` : "",
			projectDot(task.projectColor),
		].join("");
		return `<li><span class="ring p${task.priority}"></span><span class="title">${escapeHtml(task.title)}</span>${meta}</li>`;
	});
	const rest = more > 0 ? `<li class="sub">ほか ${more} 件</li>` : "";
	return `<ul>${rows.join("")}${rest}</ul>`;
}

function document(theme: WidgetTheme, body: string): string {
	return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="300">
<title>Mine</title>
<style>${themeCss(theme)}${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export function widgetPage(
	snapshot: WidgetSnapshot,
	theme: WidgetTheme
): string {
	return document(
		theme,
		`<header><h1>${dayHeading(snapshot.today)}</h1><span class="stamp mono">${snapshot.now} 更新</span></header>
${timerBlock(snapshot.timer)}
<div class="columns">
<section><h2>予定</h2>${eventList(snapshot.events)}</section>
<section><h2>タスク</h2>${taskList(snapshot.tasks, snapshot.moreTasks)}</section>
</div>`
	);
}

/** For a link that is unknown, revoked or replaced. */
export function widgetGonePage(theme: WidgetTheme): string {
	return document(
		theme,
		`<header><h1>Mine</h1></header><p class="empty">このリンクは使えません。Mine の設定「ウィジェット」で新しいリンクを発行してください。</p>`
	);
}
