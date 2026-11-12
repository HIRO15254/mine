import type { RouterOutputs } from "@mine/api/routers/index";
import { compareTasks, inView, type TaskView } from "@mine/api/tasks/views";
import { summarize } from "@mine/api/time/summary";

/**
 * Sample data for screenshots. The clock is frozen at NOW, so every date here
 * is written relative to Tuesday 2026-11-10 14:20 in Tokyo.
 */
export const TIME_ZONE = "Asia/Tokyo";
export const NOW = new Date("2026-11-10T14:20:00+09:00");

type Outputs = RouterOutputs;
type Task = Outputs["task"]["list"][number];
type Entry = Outputs["time"]["list"][number];

const at = (local: string) => new Date(`${local}+09:00`).getTime();

export const user = {
	createdAt: "2026-11-05T00:00:00.000Z",
	email: "you@example.com",
	emailVerified: true,
	id: "user-1",
	image: null,
	name: "Hiroto",
	updatedAt: "2026-11-05T00:00:00.000Z",
};

export const session = {
	createdAt: "2026-11-10T00:00:00.000Z",
	expiresAt: "2026-12-10T00:00:00.000Z",
	id: "session-1",
	token: "screens",
	updatedAt: "2026-11-10T00:00:00.000Z",
	userId: user.id,
};

export const projects: Outputs["project"]["list"] = [
	{
		archived: false,
		color: "chart-1",
		id: "p-univ",
		name: "大学",
		parentId: null,
		sortOrder: 0,
	},
	{
		archived: false,
		color: "chart-1",
		id: "p-lab",
		name: "研究",
		parentId: "p-univ",
		sortOrder: 1,
	},
	{
		archived: false,
		color: "chart-2",
		id: "p-work",
		name: "仕事",
		parentId: null,
		sortOrder: 2,
	},
	{
		archived: false,
		color: "chart-3",
		id: "p-life",
		name: "生活",
		parentId: null,
		sortOrder: 3,
	},
	{
		archived: false,
		color: "chart-4",
		id: "p-dev",
		name: "個人開発",
		parentId: null,
		sortOrder: 4,
	},
	{
		archived: false,
		color: "chart-5",
		id: "p-hobby",
		name: "趣味",
		parentId: null,
		sortOrder: 5,
	},
];

export const labels: Outputs["label"]["list"] = [
	{ id: "l-next", name: "next", sortOrder: 0 },
	{ id: "l-pc", name: "@PC", sortOrder: 1 },
	{ id: "l-home", name: "@家", sortOrder: 2 },
	{ id: "l-phone", name: "@スマートフォン", sortOrder: 3 },
];

const label = (id: string) => {
	const found = labels.find((item) => item.id === id);
	if (!found) {
		throw new Error(`Unknown label ${id}`);
	}
	return { id: found.id, name: found.name };
};

const task = (fields: Partial<Task> & Pick<Task, "id" | "title">): Task => ({
	completedAt: null,
	createdAt: "2026-11-01T00:00:00.000Z",
	deadline: null,
	estimateMinutes: null,
	labels: [],
	note: "",
	priority: 4,
	projectId: null,
	recurrence: null,
	scheduledDate: null,
	scheduledTime: null,
	startDate: null,
	...fields,
});

export const tasks: Task[] = [
	task({
		deadline: "2026-11-10",
		estimateMinutes: 90,
		id: "t-1",
		labels: [label("l-pc")],
		priority: 1,
		projectId: "p-lab",
		title: "ゼミ発表のスライドを仕上げる",
	}),
	task({
		id: "t-2",
		labels: [label("l-next"), label("l-pc")],
		priority: 2,
		projectId: "p-dev",
		title: "Mine のデザインをキャンバスに起こす",
	}),
	task({
		id: "t-3",
		priority: 3,
		estimateMinutes: 30,
		projectId: "p-work",
		scheduledDate: "2026-11-10",
		scheduledTime: "15:00",
		title: "週次レポートを送る",
		recurrence: { basis: "schedule", interval: 1, unit: "week", weekdays: [2] },
	}),
	task({
		id: "t-4",
		labels: [label("l-home")],
		projectId: "p-life",
		scheduledDate: "2026-11-09",
		title: "燃えるゴミを出す",
		recurrence: {
			basis: "schedule",
			interval: 1,
			unit: "week",
			weekdays: [1, 4],
		},
	}),
	task({
		deadline: "2026-11-14",
		id: "t-5",
		priority: 2,
		projectId: "p-univ",
		title: "情報理論のレポート第 3 回",
	}),
	task({
		id: "t-6",
		projectId: "p-hobby",
		scheduledDate: "2026-11-15",
		title: "ブリッジの練習会に申し込む",
	}),
	task({
		id: "t-7",
		labels: [label("l-phone")],
		title: "歯医者の予約を取る",
	}),
	task({
		id: "t-8",
		startDate: "2026-11-20",
		projectId: "p-dev",
		title: "Sapphire2 のリリースノートを書く",
	}),
];

const entry = (
	fields: Partial<Entry> & Pick<Entry, "id" | "startedAt">
): Entry => ({
	billable: true,
	description: "",
	endedAt: null,
	projectId: null,
	taskId: null,
	...fields,
});

export const entries: Entry[] = [
	entry({
		description: "論文を読む",
		endedAt: at("2026-11-09T12:00:00"),
		id: "e-1",
		projectId: "p-lab",
		startedAt: at("2026-11-09T09:30:00"),
	}),
	entry({
		description: "定例ミーティング",
		endedAt: at("2026-11-09T15:00:00"),
		id: "e-2",
		projectId: "p-work",
		startedAt: at("2026-11-09T14:00:00"),
	}),
	entry({
		description: "API の実装",
		endedAt: at("2026-11-09T18:40:00"),
		id: "e-3",
		projectId: "p-work",
		startedAt: at("2026-11-09T15:10:00"),
	}),
	entry({
		billable: false,
		description: "タスク画面の手直し",
		endedAt: at("2026-11-09T23:10:00"),
		id: "e-4",
		projectId: "p-dev",
		startedAt: at("2026-11-09T21:30:00"),
	}),
	entry({
		description: "実験データの整理",
		endedAt: at("2026-11-10T11:45:00"),
		id: "e-5",
		projectId: "p-lab",
		startedAt: at("2026-11-10T09:15:00"),
	}),
	entry({
		description: "ゼミ発表のスライド",
		id: "e-6",
		projectId: "p-lab",
		startedAt: at("2026-11-10T13:05:00"),
		taskId: "t-1",
	}),
];

export const rates: Outputs["rate"]["list"] = [
	{
		effectiveFrom: "2026-10-01",
		hourlyRate: 2500,
		id: "r-1",
		projectId: "p-work",
	},
];

export const calendars: Outputs["calendar"]["calendars"] = [
	{
		color: "#4593f8",
		id: "primary",
		name: "マイカレンダー",
		primary: true,
		visible: true,
	},
	{
		color: "#4cb782",
		id: "holidays",
		name: "日本の祝日",
		primary: false,
		visible: true,
	},
];

const event = (
	id: string,
	title: string,
	start: string,
	end: string,
	extra: Partial<Outputs["calendar"]["events"]["events"][number]> = {}
) => ({
	allDay: false,
	calendarId: "primary",
	color: "#4593f8",
	end: new Date(`${end}+09:00`).toISOString(),
	htmlLink: null,
	id,
	location: null,
	start: new Date(`${start}+09:00`).toISOString(),
	title,
	...extra,
});

const allEvents: Outputs["calendar"]["events"]["events"] = [
	event(
		"ev-1",
		"研究室ミーティング",
		"2026-11-10T10:00:00",
		"2026-11-10T11:00:00",
		{ location: "工学部 3 号館" }
	),
	event("ev-2", "ゼミ発表", "2026-11-10T16:30:00", "2026-11-10T18:00:00", {
		location: "講義室 B",
	}),
	event("ev-3", "夕食の買い出し", "2026-11-10T19:00:00", "2026-11-10T19:30:00"),
	event(
		"ev-4",
		"定例ミーティング",
		"2026-11-11T14:00:00",
		"2026-11-11T15:00:00"
	),
	event("ev-5", "情報理論", "2026-11-12T10:40:00", "2026-11-12T12:10:00", {
		location: "講義室 A",
	}),
	event("ev-6", "ブリッジ練習会", "2026-11-15T13:00:00", "2026-11-15T17:00:00"),
	{
		allDay: true,
		calendarId: "holidays",
		color: "#4cb782",
		end: "2026-11-24",
		htmlLink: null,
		id: "ev-7",
		location: null,
		start: "2026-11-23",
		title: "勤労感謝の日",
	},
];

export const threads: Outputs["thread"]["list"] = [
	{
		id: "th-1",
		nextAction: "キャンバスの今の画面を見て、直したいところを書く",
		projectId: "p-dev",
		status: "waiting",
		summary: "Mine UI キャンバスに今の画面を起こした。",
		title: "Claude Design 駆動のデザイン運用を作る",
		updatedAt: at("2026-11-10T13:40:00"),
		url: null,
	},
	{
		id: "th-2",
		nextAction: "",
		projectId: "p-lab",
		status: "working",
		summary: "実験データの集計を進めている。",
		title: "実験データをまとめる",
		updatedAt: at("2026-11-10T12:10:00"),
		url: null,
	},
];

export const tokens: Outputs["token"]["list"] = [
	{
		createdAt: "2026-11-06T03:00:00.000Z",
		id: "tk-1",
		lastUsedAt: "2026-11-10T04:00:00.000Z",
		name: "HTTP Shortcuts",
		prefix: "mine_3f9a",
	},
];

export const connections: Outputs["oauth"]["connections"] = [
	{
		createdAt: "2026-11-06T05:00:00.000Z",
		id: "oc-1",
		lastUsedAt: "2026-11-10T04:30:00.000Z",
		name: "Claude",
	},
];

interface Range {
	from: number;
	to: number;
}

const overlaps = (item: Entry, range: Range) =>
	item.startedAt < range.to && (item.endedAt ?? NOW.getTime()) > range.from;

function timedRange(input: unknown): { max: number; min: number } {
	const { timeMax, timeMin } = input as { timeMax: string; timeMin: string };
	return { max: Date.parse(timeMax), min: Date.parse(timeMin) };
}

function taskList(input: unknown): Task[] {
	const { today, view } = input as { today: string; view: TaskView };
	const withDates = tasks.map((item) => ({
		...item,
		createdAt: new Date(item.createdAt),
	}));
	return withDates
		.filter((item) => inView(item, view, today))
		.sort(compareTasks)
		.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));
}

/** What each tRPC query returns. Mutations are answered with null. */
export const queries: Record<string, (input: unknown) => unknown> = {
	"calendar.calendars": () => calendars,
	"calendar.events": (input) => {
		const { max, min } = timedRange(input);
		return {
			calendars,
			events: allEvents.filter((item) => {
				const start = Date.parse(
					item.allDay ? `${item.start}T00:00:00+09:00` : item.start
				);
				const end = Date.parse(
					item.allDay ? `${item.end}T00:00:00+09:00` : item.end
				);
				return start < max && end > min;
			}),
		};
	},
	"label.list": () => labels,
	me: () => user,
	"oauth.connections": () => connections,
	"project.list": () => projects,
	"rate.list": () => rates,
	"task.list": taskList,
	"thread.list": () => threads,
	"time.current": () => entries.find((item) => item.endedAt === null) ?? null,
	"time.list": (input) =>
		entries
			.filter((item) => overlaps(item, input as Range))
			.sort((a, b) => b.startedAt - a.startedAt),
	"time.summary": (input) => {
		const range = input as Range & { timeZone: string };
		return summarize(entries, {
			...range,
			now: NOW.getTime(),
			projects,
			rates,
		});
	},
	"token.list": () => tokens,
};
