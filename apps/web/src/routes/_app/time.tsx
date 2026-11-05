import { IconClockHour4 } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";

import { Page } from "@/components/app-shell/page";
import { ComingSoon } from "@/components/placeholder/coming-soon";

export const Route = createFileRoute("/_app/time")({ component: TimePage });

function TimePage() {
	return (
		<Page title="記録">
			<ComingSoon
				description="時間の記録はこれから作ります"
				icon={IconClockHour4}
			/>
		</Page>
	);
}
