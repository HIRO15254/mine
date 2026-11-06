import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({
	className,
	size = "default",
	...props
}: React.ComponentProps<"textarea"> & { size?: "default" | "xl" }) {
	return (
		<textarea
			className={cn(
				"min-h-20 w-full min-w-0 resize-y border border-input bg-card px-2.5 py-2 text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
				size === "xl"
					? "rounded-lg text-[length:var(--m-text-body)]"
					: "rounded-md text-sm",
				className
			)}
			data-size={size}
			data-slot="textarea"
			{...props}
		/>
	);
}

export { Textarea };
