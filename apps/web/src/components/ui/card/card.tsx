import type * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"section">) {
	return (
		<section
			className={cn(
				"lift flex min-w-0 flex-col rounded-lg border border-border bg-card text-card-foreground shadow-[var(--shadow-sm)]",
				className
			)}
			data-slot="card"
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 border-border-subtle border-b px-4 py-3 [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-muted-foreground",
				className
			)}
			data-slot="card-header"
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
	return (
		<h2
			className={cn(
				"m-0 min-w-0 flex-1 font-semibold text-[15px] tracking-[var(--tracking-heading)]",
				className
			)}
			data-slot="card-title"
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("min-w-0 flex-1 p-4", className)}
			data-slot="card-content"
			{...props}
		/>
	);
}

export { Card, CardContent, CardHeader, CardTitle };
