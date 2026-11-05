import {
	IconAlertTriangle,
	IconCircleCheck,
	IconCircleX,
	IconInfoCircle,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export const TOAST_CARD_CLASS =
	"flex w-[min(360px,calc(100vw-32px))] items-center gap-2.5 rounded-lg border border-border bg-popover py-3 pr-3 pl-3.5 text-foreground shadow-[var(--shadow-lg)]";

export type ToastVariant = "neutral" | "success" | "warning" | "destructive";

const VARIANT_ICONS = {
	neutral: <IconInfoCircle className="size-4 text-muted-foreground" />,
	success: <IconCircleCheck className="size-4 text-success-text" />,
	warning: <IconAlertTriangle className="size-4 text-warning-text" />,
	destructive: <IconCircleX className="size-4 text-destructive-text" />,
} satisfies Record<ToastVariant, ReactNode>;

export function Toast({
	action,
	description,
	icon,
	title,
	variant,
}: {
	action?: ReactNode;
	description?: string;
	icon?: ReactNode;
	title: string;
	variant: ToastVariant;
}) {
	return (
		<div
			className={TOAST_CARD_CLASS}
			data-slot="toast"
			role={
				variant === "warning" || variant === "destructive" ? "alert" : "status"
			}
		>
			<span aria-hidden className="flex shrink-0">
				{icon ?? VARIANT_ICONS[variant]}
			</span>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm leading-[1.4]">{title}</p>
				{description && (
					<p className="mt-0.5 text-muted-foreground text-xs leading-[1.4]">
						{description}
					</p>
				)}
			</div>
			{action}
		</div>
	);
}
