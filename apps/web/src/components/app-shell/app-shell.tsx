import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { BrandMark } from "./brand-mark";
import {
	isActive,
	MOBILE_ITEMS,
	type NavigationItem,
	PRIMARY_ITEMS,
	SETTINGS_ITEM,
} from "./navigation";
import { OfflineBanner } from "./offline-banner";

function SidebarLink({
	active,
	item,
}: {
	active: boolean;
	item: NavigationItem;
}) {
	return (
		<li>
			<Link
				aria-current={active ? "page" : undefined}
				className={cn(
					"flex h-[var(--control-md)] items-center gap-2.5 rounded-md px-2.5 font-medium text-sm no-underline outline-none transition-[background-color,color] focus-visible:shadow-[0_0_0_2px_var(--ring)]",
					active
						? "bg-primary-soft text-primary-text shadow-[var(--glow)]"
						: "hover:layer-accent active:layer-accent-pressed text-muted-foreground hover:text-foreground"
				)}
				to={item.to}
			>
				<item.icon aria-hidden size={16} />
				<span>{item.label}</span>
			</Link>
		</li>
	);
}

function TabBarLink({
	active,
	item,
}: {
	active: boolean;
	item: NavigationItem;
}) {
	return (
		<li>
			<Link
				aria-current={active ? "page" : undefined}
				className={cn(
					"flex h-12 flex-col items-center justify-center gap-[3px] font-medium text-[length:var(--m-text-tab)] no-underline",
					active
						? "text-primary-text drop-shadow-[0_0_6px_rgba(205,220,245,0.45)]"
						: "text-muted-foreground"
				)}
				to={item.to}
			>
				<item.icon aria-hidden size={24} />
				<span>{item.label}</span>
			</Link>
		</li>
	);
}

export function AppShell({ children }: { children: ReactNode }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<div className="flex h-svh bg-[image:var(--page-light)] bg-background text-foreground">
			<aside className="desk:flex hidden w-[var(--sidebar-width)] shrink-0 flex-col border-border border-r">
				<div className="flex h-12 items-center gap-2.5 px-4">
					<BrandMark size={28} />
					<span className="font-semibold text-[15px] tracking-[var(--tracking-heading)]">
						Mine
					</span>
				</div>
				<nav aria-label="メイン" className="flex flex-1 flex-col px-2 py-2">
					<ul className="flex flex-col gap-0.5">
						{PRIMARY_ITEMS.map((item) => (
							<SidebarLink
								active={isActive(pathname, item)}
								item={item}
								key={item.to}
							/>
						))}
					</ul>
					<ul className="mt-auto flex flex-col gap-0.5">
						<SidebarLink
							active={isActive(pathname, SETTINGS_ITEM)}
							item={SETTINGS_ITEM}
						/>
					</ul>
				</nav>
			</aside>
			<div className="flex min-w-0 flex-1 flex-col">
				<OfflineBanner />
				<div className="min-h-0 flex-1 overflow-auto">{children}</div>
				<nav
					aria-label="メイン"
					className="desk:hidden border-border border-t bg-background pt-1 pb-[calc(10px+env(safe-area-inset-bottom))]"
				>
					<ul className="grid grid-cols-5">
						{MOBILE_ITEMS.map((item) => (
							<TabBarLink
								active={isActive(pathname, item)}
								item={item}
								key={item.to}
							/>
						))}
					</ul>
				</nav>
			</div>
		</div>
	);
}
