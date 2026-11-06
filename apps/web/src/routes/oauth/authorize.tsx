import { createFileRoute, redirect } from "@tanstack/react-router";

import { ConsentCard } from "@/components/oauth/consent-card";
import { authClient } from "@/lib/auth-client";
import { parseAuthorizeSearch } from "@/lib/oauth";

/** OAuth consent for MCP clients such as Claude. */
export const Route = createFileRoute("/oauth/authorize")({
	validateSearch: (search: Record<string, unknown>) =>
		Object.fromEntries(
			Object.entries(search).filter(
				(entry): entry is [string, string] => typeof entry[1] === "string"
			)
		),
	beforeLoad: async ({ location }) => {
		const { data } = await authClient.getSession();
		if (!data) {
			throw redirect({ search: { redirect: location.href }, to: "/login" });
		}
	},
	component: AuthorizePage,
});

function AuthorizePage() {
	const request = parseAuthorizeSearch(Route.useSearch());

	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-3.5 py-8">
			<div className="flex w-full max-w-[440px] flex-col gap-6">
				<h1 className="m-0 font-bold text-[length:var(--m-text-large-title)] tracking-[var(--tracking-heading)]">
					Mine
				</h1>
				<ConsentCard request={request} />
			</div>
		</main>
	);
}
