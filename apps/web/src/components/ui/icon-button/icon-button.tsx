import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
	"hover:layer-accent active:layer-accent-pressed inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent p-0 outline-none transition-[background-color,color] hover:text-foreground focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				ghost: "bg-transparent text-muted-foreground",
				outline:
					"border-input bg-card text-foreground shadow-[var(--shadow-sm)]",
			},
			size: {
				sm: "size-[var(--control-sm)] [&_svg:not([class*='size-'])]:size-3.5",
				md: "size-[var(--control-md)]",
				xl: "size-[var(--m-control)] [&_svg:not([class*='size-'])]:size-[18px]",
			},
		},
		defaultVariants: {
			variant: "ghost",
			size: "md",
		},
	}
);

function IconButton({
	asChild = false,
	className,
	label,
	size = "md",
	variant = "ghost",
	...props
}: Omit<React.ComponentProps<"button">, "aria-label"> &
	VariantProps<typeof iconButtonVariants> & {
		asChild?: boolean;
		label: string;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			aria-label={label}
			className={cn(iconButtonVariants({ variant, size, className }))}
			data-slot="icon-button"
			title={label}
			{...props}
		/>
	);
}

export { IconButton };
