import type { Label, Project, Task } from "../lib/tasks";

export function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		completedAt: null,
		createdAt: "2026-11-01T00:00:00.000Z",
		deadline: null,
		estimateMinutes: null,
		id: "task-1",
		labels: [],
		note: "",
		priority: 4,
		projectId: null,
		recurrence: null,
		scheduledDate: null,
		scheduledTime: null,
		sortOrder: 0,
		startDate: null,
		title: "牛乳を買う",
		...overrides,
	};
}

export function makeProject(overrides: Partial<Project> = {}): Project {
	return {
		archived: false,
		color: "chart-1",
		id: "project-1",
		name: "大学",
		parentId: null,
		sortOrder: 0,
		...overrides,
	};
}

export function makeLabel(overrides: Partial<Label> = {}): Label {
	return { id: "label-1", name: "next", sortOrder: 0, ...overrides };
}
