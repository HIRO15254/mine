import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"group/button inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium tracking-[var(--tracking-body)] no-underline outline-none transition-[background-color,color,border-color] focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"active:layer-accent-pressed bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover",
				secondary:
					"hover:layer-accent active:layer-accent-pressed bg-muted text-foreground",
				outline:
					"hover:layer-accent active:layer-accent-pressed border-input bg-card text-foreground shadow-[var(--shadow-sm)]",
				ghost:
					"hover:layer-accent active:layer-accent-pressed bg-transparent text-muted-foreground hover:text-foreground",
				destructive:
					"active:layer-accent-pressed bg-destructive text-destructive-foreground hover:bg-destructive-hover",
				link: "bg-transparent text-primary-text underline-offset-4 hover:underline",
			},
			size: {
				default: "h-[var(--control-md)] px-3 text-sm",
				sm: "h-[var(--control-sm)] px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-[var(--control-lg)] px-4 text-sm",
				xl: "h-[var(--m-control)] rounded-lg px-[18px] text-[length:var(--m-text-body)] [&_svg:not([class*='size-'])]:size-[17px]",
				icon: "size-[var(--control-md)] p-0",
			},
		},
		compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			className={cn(buttonVariants({ variant, size, className }))}
			data-size={size}
			data-slot="button"
			data-variant={variant}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
