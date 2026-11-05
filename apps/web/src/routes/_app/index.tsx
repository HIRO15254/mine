import {
	IconCalendarTime,
	IconChartBar,
	IconChecklist,
	IconPlayerPlay,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";

import { Page } from "@/components/app-shell/page";
import { ComingSoon } from "@/components/placeholder/coming-soon";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card/card";

export const Route = createFileRoute("/_app/")({ component: TodayPage });

function TodayPage() {
	return (
		<Page title="今日">
			<div className="grid desk:grid-cols-3 desk:gap-4 gap-3.5">
				<Card className="desk:col-span-2 desk:row-span-2">
					<CardHeader>
						<IconCalendarTime aria-hidden />
						<CardTitle>タイムライン</CardTitle>
					</CardHeader>
					<CardContent>
						<ComingSoon
							description="予定と記録をここに並べます"
							icon={IconCalendarTime}
						/>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<IconPlayerPlay aria-hidden />
						<CardTitle>計測中</CardTitle>
					</CardHeader>
					<CardContent>
						<ComingSoon description="計測していません" icon={IconPlayerPlay} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<IconChecklist aria-hidden />
						<CardTitle>今日やるタスク</CardTitle>
					</CardHeader>
					<CardContent>
						<ComingSoon
							description="タスクはまだありません"
							icon={IconChecklist}
						/>
					</CardContent>
				</Card>
				<Card className="desk:col-span-3">
					<CardHeader>
						<IconChartBar aria-hidden />
						<CardTitle>今週の時間配分</CardTitle>
					</CardHeader>
					<CardContent>
						<ComingSoon
							description="記録がまだありません"
							icon={IconChartBar}
						/>
					</CardContent>
				</Card>
			</div>
		</Page>
	);
}
