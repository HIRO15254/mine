import { IconAlertTriangle, IconCalendarOff } from "@tabler/icons-react";
import { useState } from "react";
import { LoadingBlock } from "@/components/app-shell/loading-block";

import { Button } from "@/components/ui/button/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty/empty";
import { Spinner } from "@/components/ui/spinner/spinner";
import { authClient } from "@/lib/auth-client";

/** Message the API sends when Google has not granted calendar access. */
export const CALENDAR_NOT_CONNECTED = "GOOGLE_CALENDAR_NOT_CONNECTED";

export function isCalendarNotConnected(error: unknown): boolean {
	return error instanceof Error && error.message === CALENDAR_NOT_CONNECTED;
}

export function CalendarLoading() {
	return <LoadingBlock />;
}

/** Error or reconnect prompt for a failed calendar query. */
export function CalendarError({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	if (isCalendarNotConnected(error)) {
		return <ConnectCalendar />;
	}
	return (
		<Empty className="py-8">
			<EmptyHeader>
				<EmptyMedia>
					<IconAlertTriangle aria-hidden />
				</EmptyMedia>
				<EmptyTitle>予定を読み込めませんでした</EmptyTitle>
				<EmptyDescription>
					時間をおいてもう一度お試しください。
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button onClick={onRetry} type="button" variant="secondary">
					再読み込み
				</Button>
			</EmptyContent>
		</Empty>
	);
}

/**
 * Signs in with Google again, which asks for the calendar permissions the
 * app needs now, and comes back to this page. False if it could not start.
 */
export async function connectGoogle(): Promise<boolean> {
	const result = await authClient.signIn.social({
		provider: "google",
		callbackURL: window.location.href,
		errorCallbackURL: `${window.location.origin}/login`,
	});
	return !result.error;
}

function ConnectCalendar() {
	const [isRedirecting, setIsRedirecting] = useState(false);

	const connect = async () => {
		setIsRedirecting(true);
		if (!(await connectGoogle())) {
			setIsRedirecting(false);
		}
	};

	return (
		<Empty className="py-8">
			<EmptyHeader>
				<EmptyMedia>
					<IconCalendarOff aria-hidden />
				</EmptyMedia>
				<EmptyTitle>Google カレンダーと連携していません</EmptyTitle>
				<EmptyDescription>
					予定を表示・編集するには、カレンダーへのアクセスを許可してください。
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button disabled={isRedirecting} onClick={connect} type="button">
					{isRedirecting && <Spinner />}
					カレンダーを連携
				</Button>
			</EmptyContent>
		</Empty>
	);
}
