import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { BrandMark } from "@/components/app-shell/brand-mark";
import { GoogleIcon } from "@/components/icons/google";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert/alert";
import { Button } from "@/components/ui/button/button";
import { Spinner } from "@/components/ui/spinner/spinner";
import { authClient } from "@/lib/auth-client";
import { checkSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): { error?: string } =>
		typeof search.error === "string" ? { error: search.error } : {},
	beforeLoad: async () => {
		// Without an answer the sign-in screen still opens.
		const session = await checkSession();
		if (session.state === "signed-in") {
			throw redirect({ to: "/" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const { error } = Route.useSearch();
	const [isRedirecting, setIsRedirecting] = useState(false);

	const signIn = async () => {
		setIsRedirecting(true);
		const origin = window.location.origin;
		const result = await authClient.signIn.social({
			provider: "google",
			callbackURL: `${origin}/`,
			errorCallbackURL: `${origin}/login`,
		});
		if (result.error) {
			setIsRedirecting(false);
		}
	};

	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-3.5">
			<div className="flex w-full max-w-[440px] flex-col gap-6">
				<div className="flex flex-col gap-1.5">
					<BrandMark className="mb-3" size={64} />
					<h1 className="m-0 font-bold text-[length:var(--m-text-large-title)] tracking-[var(--tracking-heading)]">
						Mine
					</h1>
					<p className="m-0 text-[length:var(--m-text-secondary)] text-muted-foreground">
						予定・タスク・時間の記録をひとつに
					</p>
				</div>
				{error && (
					<Alert variant="destructive">
						<AlertTitle>ログインできませんでした</AlertTitle>
						<AlertDescription>
							許可されたアカウントでもう一度お試しください。
						</AlertDescription>
					</Alert>
				)}
				<Button
					disabled={isRedirecting}
					onClick={signIn}
					size="xl"
					type="button"
					variant="outline"
				>
					{isRedirecting ? <Spinner /> : <GoogleIcon className="size-[18px]" />}
					Google でログイン
				</Button>
			</div>
		</main>
	);
}
