import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";

import { ThemeProvider } from "@/components/theme-provider/theme-provider";
import { Toaster } from "@/components/ui/sonner/sonner";
import type { trpc } from "@/lib/trpc";

import "../index.css";

export interface RouterAppContext {
	queryClient: QueryClient;
	trpc: typeof trpc;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{ title: "Mine" },
			{ name: "description", content: "予定・タスク・時間の記録をひとつに" },
		],
		links: [{ rel: "icon", href: "/logo.png" }],
	}),
});

function RootComponent() {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
		>
			<HeadContent />
			<Outlet />
			<Toaster />
		</ThemeProvider>
	);
}
