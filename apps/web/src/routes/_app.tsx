import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell/app-shell";
import { authClient } from "@/lib/auth-client";
import { isOffline, rememberUser, savedUser } from "@/lib/offline";

async function currentSession() {
	try {
		const { data } = await authClient.getSession();
		return data;
	} catch {
		return null;
	}
}

export const Route = createFileRoute("/_app")({
	beforeLoad: async () => {
		const data = await currentSession();
		if (data) {
			rememberUser(data.user);
			return { user: data.user };
		}
		// Offline, open with the last signed-in user and the saved data.
		const user = isOffline() ? savedUser() : null;
		if (!user) {
			throw redirect({ to: "/login" });
		}
		return { user };
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
