import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => import("./test-api"));
vi.mock("@/lib/auth-client", () => ({
	authClient: { getSession, signIn: { social: vi.fn() }, signOut: vi.fn() },
}));
vi.mock("@mine/env/web", () => ({
	env: { VITE_SERVER_URL: "https://api.example.test" },
}));

import { RouteError, RouteNotFound } from "../components/app-shell/route-error";
import { rememberUser, savedUser } from "../lib/offline";
import { forgetSession } from "../lib/session";
import { routeTree } from "../routeTree.gen";
import { freezeNow } from "./clock";
import { useDesktopLayout } from "./render";
import { api, trpc } from "./test-api";

const user = { email: "me@example.com", id: "u1", name: "Me" };
const signedIn = () =>
	getSession.mockResolvedValue({ data: { user }, error: null });
const signedOut = () =>
	getSession.mockResolvedValue({ data: null, error: null });
const noAnswer = () =>
	getSession.mockRejectedValue(new TypeError("Failed to fetch"));

const SIGN_IN = "Google でログイン";
const THIS_WEEK = /11月9日/;
const EARLIER_WEEK = /10月5日/;

/** Opens the app at `path`, as typing the address would. */
function open(path: string) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const router = createRouter({
		context: { queryClient, trpc },
		defaultErrorComponent: RouteError,
		defaultNotFoundComponent: RouteNotFound,
		history: createMemoryHistory({ initialEntries: [path] }),
		routeTree,
		Wrap: ({ children }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	});
	render(<RouterProvider router={router} />);
	return { queryClient, router };
}

const heading = (name: RegExp | string) =>
	screen.findByRole("heading", { level: 1, name });

describe("routes", () => {
	beforeEach(async () => {
		await api.reset();
		getSession.mockReset();
		forgetSession();
		window.localStorage.clear();
		useDesktopLayout();
		// The router scrolls to the top on every navigation; jsdom cannot.
		window.scrollTo = () => undefined;
		freezeNow();
	});

	describe("the guard", () => {
		it("sends a signed-out visitor to the sign-in screen and forgets saved data", async () => {
			signedOut();
			rememberUser(user);

			const { router } = open("/tasks");

			expect(
				await screen.findByRole("button", { name: SIGN_IN })
			).toBeVisible();
			expect(router.state.location.pathname).toBe("/login");
			expect(savedUser()).toBeNull();
		});

		it("opens with the saved user when the API does not answer", async () => {
			noAnswer();
			rememberUser(user);

			const { router } = open("/");

			expect(await heading("今日")).toBeVisible();
			expect(router.state.location.pathname).toBe("/");
			expect(savedUser()).toMatchObject({ id: "u1" });
		});

		it("asks to sign in when there is no answer and nobody was signed in", async () => {
			noAnswer();

			const { router } = open("/");

			expect(
				await screen.findByRole("button", { name: SIGN_IN })
			).toBeVisible();
			expect(router.state.location.pathname).toBe("/login");
		});

		it("takes a signed-in visitor from the sign-in screen to Today", async () => {
			signedIn();

			const { router } = open("/login");

			expect(await heading("今日")).toBeVisible();
			expect(router.state.location.pathname).toBe("/");
			// Remembered for the next start without a connection.
			expect(savedUser()).toMatchObject({ id: "u1" });
		});

		it("says why when sign-in came back with an error", async () => {
			signedOut();

			open("/login?error=unable_to_create_user");

			expect(await screen.findByText("ログインできませんでした")).toBeVisible();
		});
	});

	describe("each screen", () => {
		beforeEach(() => signedIn());

		it.each([
			["/", "今日"],
			["/tasks", "タスク"],
			["/calendar", THIS_WEEK],
			["/time", THIS_WEEK],
			["/settings", "設定"],
		])("%s opens under its title", async (path, title) => {
			open(path);

			expect(await heading(title)).toBeVisible();
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		});

		it("shows the not-found screen for an unknown address", async () => {
			open("/nowhere");

			expect(await screen.findByText("ページが見つかりません")).toBeVisible();
		});
	});

	describe("search parameters", () => {
		beforeEach(() => signedIn());

		it("drops a week that is not a day and shows this week", async () => {
			open("/calendar?week=next");

			expect(await heading(THIS_WEEK)).toBeVisible();
		});

		it("shows the week in the address", async () => {
			open("/time?week=2026-10-05");

			expect(await heading(EARLIER_WEEK)).toBeVisible();
		});

		it("opens on the upcoming tasks when the address names no view", async () => {
			await api.caller.task.create({
				scheduledDate: "2026-11-10",
				title: "今日やる",
			});
			await api.caller.task.create({
				scheduledDate: "2026-11-12",
				title: "あさってやる",
			});

			open("/tasks");

			expect(await screen.findByText("あさってやる")).toBeVisible();
			expect(screen.getByRole("radio", { name: "近日" })).toBeChecked();
			expect(screen.queryByText("今日やる")).not.toBeInTheDocument();
		});

		it("falls back to the upcoming tasks for an unknown view", async () => {
			await api.caller.task.create({ title: "いつかやる" });
			await api.caller.task.create({
				scheduledDate: "2026-11-11",
				title: "明日やる",
			});

			open("/tasks?view=everything");

			expect(await screen.findByText("明日やる")).toBeVisible();
			expect(screen.queryByText("いつかやる")).not.toBeInTheDocument();
			// The server never saw the view it would have refused.
			expect(api.calls("task.list")).toEqual([
				{ today: "2026-11-10", view: "upcoming" },
			]);
		});

		it("opens Today's tasks from the Today screen", async () => {
			await api.caller.task.create({
				scheduledDate: "2026-11-10",
				title: "今日やる",
			});
			const { router } = open("/");
			await screen.findByText("今日やる");

			// The sidebar links to the tasks too; this one is on the Today card.
			const link = screen
				.getAllByRole("link", { name: "タスク" })
				.find((item) => item.getAttribute("href")?.includes("view=today"));
			expect(link).toBeDefined();
			await userEvent.click(link as HTMLElement);

			expect(await heading("タスク")).toBeVisible();
			expect(router.state.location.search).toEqual({ view: "today" });
			expect(screen.getByRole("radio", { name: "今日" })).toBeChecked();
		});

		it("opens the view and the project the address names", async () => {
			const work = await api.caller.project.create({ name: "仕事" });
			await api.caller.task.create({ projectId: work.id, title: "見積もり" });
			await api.caller.task.create({ title: "牛乳を買う" });

			open(`/tasks?view=open&project=${work.id}`);

			expect(await screen.findByText("見積もり")).toBeVisible();
			await waitFor(() =>
				expect(screen.queryByText("牛乳を買う")).not.toBeInTheDocument()
			);
		});

		it("starts the quick-add box with shared text", async () => {
			open(`/tasks?add=${encodeURIComponent("本を返す")}`);

			expect(await screen.findByDisplayValue("本を返す")).toBeVisible();
		});
	});
});
