import { IconRefresh, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { useAppUpdate } from "@/lib/pwa-update";

/** Offers the new version after a deploy; tapping 更新 reloads into it. */
export function UpdateBanner() {
	const { dismiss, needRefresh, update } = useAppUpdate();
	const [updating, setUpdating] = useState(false);
	if (!needRefresh) {
		return null;
	}
	return (
		<div
			className="flex items-center gap-2 border-border border-b bg-primary-soft py-1.5 pr-1.5 pl-4 desk:text-sm text-primary-text text-xs"
			data-slot="update-banner"
			role="status"
		>
			<IconRefresh aria-hidden className="size-4 shrink-0" />
			<span className="min-w-0 flex-1">新しいバージョンがあります</span>
			<Button
				disabled={updating}
				onClick={() => {
					setUpdating(true);
					update();
				}}
				size="sm"
				type="button"
			>
				更新
			</Button>
			<IconButton label="あとで" onClick={dismiss} size="sm">
				<IconX aria-hidden />
			</IconButton>
		</div>
	);
}
