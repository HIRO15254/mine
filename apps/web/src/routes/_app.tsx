import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell/app-shell";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_app")({
	beforeLoad: async () => {
		const { data } = await authClient.getSession();
		if (!data) {
			throw redirect({ to: "/login" });
		}
		return { user: data.user };
	},
	component: AppLayout,
});

function AppLayout() {
	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}
