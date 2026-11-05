import { IconChevronDown } from "@tabler/icons-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** Platform select styled like Input; best for short option lists on mobile. */
function NativeSelect({
	className,
	size = "default",
	...props
}: Omit<React.ComponentProps<"select">, "size"> & {
	size?: "default" | "xl";
}) {
	return (
		<div className="relative min-w-0" data-slot="native-select-wrapper">
			<select
				className={cn(
					"w-full min-w-0 cursor-pointer appearance-none border border-input bg-card pr-8 pl-2.5 text-foreground outline-none transition-[border-color,box-shadow] focus:border-ring focus:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
					size === "xl"
						? "h-[var(--m-control)] rounded-lg text-[length:var(--m-text-body)]"
						: "h-[var(--control-md)] rounded-md text-sm",
					className
				)}
				data-size={size}
				data-slot="native-select"
				{...props}
			/>
			<IconChevronDown
				aria-hidden
				className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
			/>
		</div>
	);
}

export { NativeSelect };
