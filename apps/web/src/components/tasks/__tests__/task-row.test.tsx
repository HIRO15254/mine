import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeProject, makeTask } from "../../../__tests__/task-fixtures";
import { TaskRow } from "../task-row";

const projects = [
	makeProject({ id: "uni", name: "大学" }),
	makeProject({ id: "lab", name: "研究", parentId: "uni" }),
];

describe("TaskRow", () => {
	it("shows dates, recurrence, labels and the project", () => {
		render(
			<TaskRow
				onComplete={vi.fn()}
				onOpen={vi.fn()}
				projects={projects}
				task={makeTask({
					deadline: "2026-11-20",
					estimateMinutes: 25,
					labels: [{ id: "l", name: "next" }],
					projectId: "lab",
					recurrence: {
						basis: "schedule",
						interval: 1,
						unit: "week",
						weekdays: [1],
					},
					scheduledDate: "2026-11-06",
				})}
				today="2026-11-05"
			/>
		);

		expect(screen.getByText("明日")).toBeInTheDocument();
		expect(screen.getByText("11月20日(金)まで")).toBeInTheDocument();
		expect(screen.getByText("毎週 月")).toBeInTheDocument();
		expect(screen.getByText("25分")).toBeInTheDocument();
		expect(screen.getByText("next")).toBeInTheDocument();
		expect(screen.getByText("大学 / 研究")).toBeInTheDocument();
	});

	it("completes and opens the task", async () => {
		const onComplete = vi.fn();
		const onOpen = vi.fn();
		const task = makeTask();
		render(
			<TaskRow
				onComplete={onComplete}
				onOpen={onOpen}
				projects={[]}
				showProject={false}
				task={task}
				today="2026-11-05"
			/>
		);

		await userEvent.click(
			screen.getByRole("button", { name: "「牛乳を買う」を完了にする" })
		);
		await userEvent.click(screen.getByRole("button", { name: "牛乳を買う" }));

		expect(onComplete).toHaveBeenCalledWith(task);
		expect(onOpen).toHaveBeenCalledWith(task);
	});

	it("buzzes on a phone when the task is checked", async () => {
		const vibrate = vi.fn(() => true);
		Object.defineProperty(navigator, "vibrate", {
			configurable: true,
			value: vibrate,
		});
		try {
			render(
				<TaskRow
					onComplete={vi.fn()}
					onOpen={vi.fn()}
					projects={[]}
					task={makeTask()}
					today="2026-11-05"
				/>
			);

			await userEvent.click(
				screen.getByRole("button", { name: "「牛乳を買う」を完了にする" })
			);

			expect(vibrate).toHaveBeenCalledOnce();
		} finally {
			Reflect.deleteProperty(navigator, "vibrate");
		}
	});

	it("shows the check and strikes the title while completing", () => {
		render(
			<TaskRow
				isCompleting
				onComplete={vi.fn()}
				onOpen={vi.fn()}
				projects={[]}
				task={makeTask()}
				today="2026-11-05"
			/>
		);

		const check = screen.getByRole("button", {
			name: "「牛乳を買う」を完了にする",
		});
		expect(check).toBeDisabled();
		expect(check).toHaveClass("check-done");
		expect(screen.getByText("牛乳を買う")).toHaveClass("line-through");
	});
});
