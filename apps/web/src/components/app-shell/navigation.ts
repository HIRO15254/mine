import {
	IconCalendar,
	IconChecklist,
	IconClockHour4,
	IconHome,
	IconSettings,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

export interface NavigationItem {
	exact?: boolean;
	icon: ComponentType<{ className?: string; size?: number; stroke?: number }>;
	label: string;
	to: "/" | "/tasks" | "/time" | "/calendar" | "/settings";
}

export const PRIMARY_ITEMS: readonly NavigationItem[] = [
	{ to: "/", label: "今日", icon: IconHome, exact: true },
	{ to: "/tasks", label: "タスク", icon: IconChecklist },
	{ to: "/time", label: "記録", icon: IconClockHour4 },
	{ to: "/calendar", label: "カレンダー", icon: IconCalendar },
];

export const SETTINGS_ITEM: NavigationItem = {
	to: "/settings",
	label: "設定",
	icon: IconSettings,
};

export const MOBILE_ITEMS: readonly NavigationItem[] = [
	...PRIMARY_ITEMS,
	SETTINGS_ITEM,
];

export function isActive(
	currentPath: string,
	item: Pick<NavigationItem, "exact" | "to">
): boolean {
	if (item.exact || item.to === "/") {
		return currentPath === item.to;
	}
	return currentPath === item.to || currentPath.startsWith(`${item.to}/`);
}
