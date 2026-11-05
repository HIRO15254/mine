import { IconCircleX, IconInfoCircle } from "@tabler/icons-react";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
	"grid grid-cols-[auto_1fr] gap-2.5 rounded-lg border border-border px-3.5 py-3 text-foreground text-sm",
	{
		variants: {
			variant: {
				default: "bg-card",
				destructive: "bg-destructive-soft",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

const ALERT_ICONS = {
	default: (
		<IconInfoCircle aria-hidden className="mt-px size-4 text-primary-text" />
	),
	destructive: (
		<IconCircleX aria-hidden className="mt-px size-4 text-destructive-text" />
	),
};

function Alert({
	children,
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			className={cn(alertVariants({ variant }), className)}
			data-slot="alert"
			role={variant === "destructive" ? "alert" : "status"}
			{...props}
		>
			{ALERT_ICONS[variant ?? "default"]}
			<div>{children}</div>
		</div>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"m-0 font-semibold text-sm tracking-[var(--tracking-heading)]",
				className
			)}
			data-slot="alert-title"
			{...props}
		/>
	);
}

function AlertDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn("mt-0.5 mb-0 text-muted-foreground text-sm", className)}
			data-slot="alert-description"
			{...props}
		/>
	);
}

export { Alert, AlertDescription, AlertTitle };
