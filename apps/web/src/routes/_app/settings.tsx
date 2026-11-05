import {
	IconDeviceDesktop,
	IconLogout,
	IconMoon,
	IconSun,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTheme } from "next-themes";

import { Page } from "@/components/app-shell/page";
import { Button } from "@/components/ui/button/button";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
} from "@/components/ui/item/item";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/components/ui/toggle-group/toggle-group";
import { authClient } from "@/lib/auth-client";

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
