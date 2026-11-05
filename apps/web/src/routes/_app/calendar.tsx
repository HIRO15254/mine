import { IconCalendar } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";

import { Page } from "@/components/app-shell/page";
import { ComingSoon } from "@/components/placeholder/coming-soon";

export const Route = createFileRoute("/_app/calendar")({
	component: CalendarPage,
});

function CalendarPage() {
	return (
		<Page title="カレンダー">
			<ComingSoon
				description="Google カレンダーとの連携はこれから作ります"
				icon={IconCalendar}
			/>
		</Page>
	);
}
