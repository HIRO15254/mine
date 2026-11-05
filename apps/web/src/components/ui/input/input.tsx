import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
	"w-full min-w-0 border border-input bg-card px-2.5 text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus:shadow-[0_0_0_1px_var(--destructive)]",
	{
		variants: {
			size: {
				default: "h-[var(--control-md)] rounded-md text-sm",
				xl: "h-[var(--m-control)] rounded-lg text-[length:var(--m-text-body)]",
			},
		},
		defaultVariants: {
			size: "default",
		},
	}
);

function Input({
	className,
	size = "default",
	type,
	...props
}: Omit<React.ComponentProps<"input">, "size"> &
	VariantProps<typeof inputVariants>) {
	return (
		<input
			className={cn(inputVariants({ size, className }))}
			data-size={size}
			data-slot="input"
			type={type}
			{...props}
		/>
	);
}

export { Input };
