import { IconWifiOff } from "@tabler/icons-react";

import { useOnline } from "@/hooks/use-online";

export function OfflineBanner() {
	const online = useOnline();
	if (online) {
		return null;
	}
	return (
		<div
			className="flex items-center gap-2 border-border border-b bg-muted px-4 py-1.5 text-muted-foreground text-xs"
			role="status"
		>
			<IconWifiOff aria-hidden className="size-3.5 shrink-0" />
			オフラインです。前回読み込んだ内容を表示しています
		</div>
	);
}
