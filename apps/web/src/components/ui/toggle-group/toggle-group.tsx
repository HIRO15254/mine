import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function ToggleGroup({
	className,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
	return (
		<ToggleGroupPrimitive.Root
			className={cn(
				"grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-1.5",
				className
			)}
			data-slot="toggle-group"
			{...props}
		/>
	);
}

function ToggleGroupItem({
	className,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
	return (
		<ToggleGroupPrimitive.Item
			className={cn(
				"active:layer-accent-pressed data-[state=off]:hover:layer-accent inline-flex h-[var(--m-control)] min-w-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-input bg-card px-3.5 font-medium text-[length:var(--m-text-secondary)] text-muted-foreground outline-none transition-[background-color,color,border-color] focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:border-ring data-[state=on]:bg-primary-soft data-[state=on]:text-primary-text data-[state=off]:hover:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
				className
			)}
			data-slot="toggle-group-item"
			{...props}
		/>
	);
}

export { ToggleGroup, ToggleGroupItem };
