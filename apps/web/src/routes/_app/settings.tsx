import {
	IconDeviceDesktop,
	IconLogout,
	IconMoon,
	IconSun,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTheme } from "next-themes";

import { Page } from "@/components/app-shell/page";
import {
	CalendarError,
	CalendarLoading,
} from "@/components/calendar/calendar-status";
import { LabelSettings } from "@/components/tasks/label-settings";
import { ProjectSettings } from "@/components/tasks/project-settings";
import { Button } from "@/components/ui/button/button";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item/item";
import { Switch } from "@/components/ui/switch/switch";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/components/ui/toggle-group/toggle-group";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const { user } = Route.useRouteContext();
	const { theme, setTheme } = useTheme();
	const navigate = useNavigate();

	const signOut = async () => {
		await authClient.signOut();
		await navigate({ to: "/login" });
	};

	return (
		<Page title="設定">
			<div className="flex max-w-[560px] flex-col gap-6">
				<section className="flex flex-col gap-2">
					<h2 className="m-0 font-semibold text-sm">外観</h2>
					<ToggleGroup
						aria-label="テーマ"
						onValueChange={(value) => {
							if (value) {
								setTheme(value);
							}
						}}
						type="single"
						value={theme}
					>
						<ToggleGroupItem value="light">
							<IconSun aria-hidden />
							ライト
						</ToggleGroupItem>
						<ToggleGroupItem value="dark">
							<IconMoon aria-hidden />
							ダーク
						</ToggleGroupItem>
						<ToggleGroupItem value="system">
							<IconDeviceDesktop aria-hidden />
							端末に合わせる
						</ToggleGroupItem>
					</ToggleGroup>
				</section>
				<section className="flex flex-col gap-2">
					<h2 className="m-0 font-semibold text-sm">プロジェクト</h2>
					<ProjectSettings />
				</section>
				<section className="flex flex-col gap-2">
					<h2 className="m-0 font-semibold text-sm">ラベル</h2>
					<LabelSettings />
				</section>
				<section className="flex flex-col gap-2">
					<h2 className="m-0 font-semibold text-sm">表示するカレンダー</h2>
					<CalendarSettings />
				</section>
				<section className="flex flex-col gap-2">
					<h2 className="m-0 font-semibold text-sm">アカウント</h2>
					<ItemGroup className="rounded-lg border border-border bg-card">
						<Item>
							<ItemContent>
								<ItemTitle>{user.name}</ItemTitle>
								<ItemDescription>{user.email}</ItemDescription>
							</ItemContent>
						</Item>
					</ItemGroup>
					<Button
						className="self-start"
						onClick={signOut}
						type="button"
						variant="secondary"
					>
						<IconLogout aria-hidden />
						ログアウト
					</Button>
				</section>
			</div>
		</Page>
	);
}

function CalendarSettings() {
	const queryClient = useQueryClient();
	const calendars = useQuery(trpc.calendar.calendars.queryOptions());
	const setVisibility = useMutation(
		trpc.calendar.setVisibility.mutationOptions({
			onMutate: async ({ calendarId, visible }) => {
				const key = trpc.calendar.calendars.queryKey();
				await queryClient.cancelQueries({ queryKey: key });
				queryClient.setQueryData(key, (current) =>
					current?.map((calendar) =>
						calendar.id === calendarId ? { ...calendar, visible } : calendar
					)
				);
			},
			onSettled: () =>
				Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.calendar.calendars.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.calendar.events.pathKey(),
					}),
				]),
		})
	);

	if (calendars.isPending) {
		return <CalendarLoading />;
	}
	if (calendars.isError) {
		return (
			<CalendarError
				error={calendars.error}
				onRetry={() => calendars.refetch()}
			/>
		);
	}
	return (
		<ItemGroup className="rounded-lg border border-border bg-card">
			{calendars.data.map((calendar) => (
				<Item key={calendar.id}>
					<ItemMedia>
						<span
							aria-hidden
							className="size-2.5 rounded-full"
							style={{ backgroundColor: calendar.color }}
						/>
					</ItemMedia>
					<ItemContent>
						<ItemTitle>
							<label
								className="cursor-pointer"
								htmlFor={`calendar-${calendar.id}`}
							>
								{calendar.name}
							</label>
						</ItemTitle>
					</ItemContent>
					<Switch
						checked={calendar.visible}
						id={`calendar-${calendar.id}`}
						onCheckedChange={(visible) =>
							setVisibility.mutate({ calendarId: calendar.id, visible })
						}
					/>
				</Item>
			))}
		</ItemGroup>
	);
}
