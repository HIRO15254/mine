import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell/app-shell";
import { clearOfflineData, rememberUser, savedUser } from "@/lib/offline";
import { checkSession } from "@/lib/session";

export const Route = createFileRoute("/_app")({
	beforeLoad: async ({ context }) => {
		const session = await checkSession();
		if (session.state === "signed-in") {
			rememberUser(session.user);
			return { user: session.user };
		}
		if (session.state === "signed-out") {
			context.queryClient.clear();
			clearOfflineData();
			throw redirect({ to: "/login" });
		}
		// No answer (offline, or the API is briefly out of reach): open with
		// the last signed-in user and the saved data rather than signing out.
		const user = savedUser();
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
