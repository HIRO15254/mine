import { IconChecklist } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";

import { Page } from "@/components/app-shell/page";
import { ComingSoon } from "@/components/placeholder/coming-soon";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

function TasksPage() {
	return (
		<Page title="タスク">
			<ComingSoon
				description="タスク管理はこれから作ります"
				icon={IconChecklist}
			/>
		</Page>
	);
}
