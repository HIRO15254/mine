import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { BrandMark } from "./brand-mark";

export function Page({
	actions,
	children,
	className,
	title,
}: {
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	title: string;
}) {
	return (
		<div className="flex min-h-full flex-col">
			<header className="sticky top-0 z-10 flex desk:h-12 h-[var(--m-navbar-height)] shrink-0 items-center gap-2 border-border border-b bg-background desk:px-6 px-3.5 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[image:var(--prism)] after:opacity-80">
				<BrandMark className="mr-0.5 desk:hidden" size={24} />
				<h1 className="m-0 min-w-0 flex-1 font-semibold desk:text-[15px] text-[length:var(--m-text-title)] tracking-[var(--tracking-heading)]">
					{title}
				</h1>
				{actions && (
					<div className="flex shrink-0 items-center gap-2">{actions}</div>
				)}
			</header>
			<main
				className={cn(
					"mx-auto w-full desk:max-w-[var(--content-max)] flex-1 desk:px-6 px-3.5 desk:py-6 py-3.5",
					className
				)}
			>
				{children}
			</main>
		</div>
	);
}
