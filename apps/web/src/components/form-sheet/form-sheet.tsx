import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog/dialog";
import {
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer/drawer";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { useIsDesk } from "@/hooks/use-media-query";

interface FormSheetProps {
	children: ReactNode;
	confirmLabel?: string;
	/** Extra actions shown at the start of the desktop footer, e.g. delete. */
	extraActions?: ReactNode;
	formId: string;
	isSaving?: boolean;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

/** A form container: a Dialog on desktop and a bottom Drawer on mobile. */
export function FormSheet({
	children,
	confirmLabel = "保存",
	extraActions,
	formId,
	isSaving = false,
	onOpenChange,
	open,
	title,
}: FormSheetProps) {
	const isDesk = useIsDesk();

	if (isDesk) {
		return (
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent className="w-[min(520px,calc(100vw-32px))]">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription className="sr-only">{title}</DialogDescription>
					</DialogHeader>
					<DialogBody className="max-h-[60vh] overflow-y-auto">
						{children}
					</DialogBody>
					<DialogFooter>
						{extraActions && <div className="mr-auto">{extraActions}</div>}
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="ghost"
						>
							キャンセル
						</Button>
						<Button disabled={isSaving} form={formId} type="submit">
							{isSaving && <IconLoader2 aria-hidden className="animate-spin" />}
							{confirmLabel}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent>
				<div className="grid min-h-[var(--m-navbar-height)] shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center border-border border-b px-1 py-0.5">
					<IconButton
						className="justify-self-start text-foreground [&_svg:not([class*='size-'])]:size-6"
						label="キャンセル"
						onClick={() => onOpenChange(false)}
						size="xl"
						type="button"
					>
						<IconX aria-hidden />
					</IconButton>
					<DrawerTitle className="text-center">{title}</DrawerTitle>
					<IconButton
						aria-busy={isSaving}
						className="justify-self-end text-primary-text hover:text-primary-text [&_svg:not([class*='size-'])]:size-6"
						disabled={isSaving}
						form={formId}
						label={confirmLabel}
						size="xl"
						type="submit"
					>
						{isSaving ? (
							<IconLoader2 aria-hidden className="animate-spin" />
						) : (
							<IconCheck aria-hidden />
						)}
					</IconButton>
				</div>
				<DrawerDescription className="sr-only">{title}</DrawerDescription>
				<DrawerBody>
					{children}
					{extraActions && <div className="mt-4">{extraActions}</div>}
				</DrawerBody>
			</DrawerContent>
		</Drawer>
	);
}
