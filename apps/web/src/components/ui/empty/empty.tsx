import type * as React from "react";

import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-col items-center justify-center gap-3.5 px-6 py-12 text-center text-foreground",
				className
			)}
			data-slot="empty"
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex flex-col items-center gap-1.5", className)}
			data-slot="empty-header"
			{...props}
		/>
	);
}

function EmptyMedia({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"mb-0.5 flex items-center justify-center text-muted-foreground [&_svg:not([class*='size-'])]:size-6",
				className
			)}
			data-slot="empty-media"
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn("m-0 font-medium text-sm", className)}
			data-slot="empty-title"
			{...props}
		/>
	);
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"m-0 max-w-[44ch] text-muted-foreground text-sm",
				className
			)}
			data-slot="empty-description"
			{...props}
		/>
	);
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex flex-wrap justify-center gap-2", className)}
			data-slot="empty-content"
			{...props}
		/>
	);
}

export {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
};
