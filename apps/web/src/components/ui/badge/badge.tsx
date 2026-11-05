import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex h-5 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-transparent px-[7px] font-medium text-xs [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground",
				secondary: "bg-muted text-foreground",
				destructive: "bg-destructive-soft text-destructive-text",
				outline: "border-border bg-transparent text-muted-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

function Badge({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<span
			className={cn(badgeVariants({ variant }), className)}
			data-slot="badge"
			data-variant={variant}
			{...props}
		/>
	);
}

export { Badge };
