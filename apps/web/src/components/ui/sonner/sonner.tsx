"use client";

import {
	IconAlertTriangle,
	IconCircleCheck,
	IconCircleX,
	IconInfoCircle,
	IconLoader2,
} from "@tabler/icons-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { buttonVariants } from "@/components/ui/button/button";
import { TOAST_CARD_CLASS } from "./toast";
import { useToaster } from "./use-toaster";

export function Toaster() {
	const { theme } = useToaster();
	return (
		<Sonner
			className="toaster"
			icons={{
				success: <IconCircleCheck className="size-4 text-success-text" />,
				error: <IconCircleX className="size-4 text-destructive-text" />,
				warning: <IconAlertTriangle className="size-4 text-warning-text" />,
				info: <IconInfoCircle className="size-4 text-muted-foreground" />,
				loading: (
					<IconLoader2 className="size-4 animate-spin text-muted-foreground" />
				),
			}}
			mobileOffset={{ bottom: "calc(62px + env(safe-area-inset-bottom))" }}
			offset={{ bottom: "calc(62px + env(safe-area-inset-bottom))" }}
			position="bottom-center"
			theme={theme as ToasterProps["theme"]}
			toastOptions={{
				unstyled: true,
				classNames: {
					toast: TOAST_CARD_CLASS,
					content: "min-w-0 flex-1",
					title: "font-medium text-sm leading-[1.4]",
					description: "mt-0.5 text-muted-foreground text-xs leading-[1.4]",
					actionButton: buttonVariants({ variant: "ghost", size: "sm" }),
				},
			}}
		/>
	);
}
