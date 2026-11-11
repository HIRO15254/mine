import { IconAlertTriangle, IconMapOff } from "@tabler/icons-react";
import {
	type ErrorComponentProps,
	Link,
	useRouter,
} from "@tanstack/react-router";

import { Button } from "@/components/ui/button/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty/empty";

/** Shown in place of a screen that threw while loading or drawing. */
export function RouteError({ reset }: ErrorComponentProps) {
	const router = useRouter();
	return (
		<Empty className="min-h-svh" role="alert">
			<EmptyHeader>
				<EmptyMedia>
					<IconAlertTriangle aria-hidden />
				</EmptyMedia>
				<EmptyTitle>表示できませんでした</EmptyTitle>
				<EmptyDescription>
					もう一度試すか、今日の画面に戻ってください。
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button
					onClick={() => {
						reset();
						router.invalidate();
					}}
					type="button"
				>
					もう一度試す
				</Button>
				<Button asChild variant="outline">
					<Link to="/">今日に戻る</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

/** Shown for an address no screen answers to. */
export function RouteNotFound() {
	return (
		<Empty className="min-h-svh">
			<EmptyHeader>
				<EmptyMedia>
					<IconMapOff aria-hidden />
				</EmptyMedia>
				<EmptyTitle>ページが見つかりません</EmptyTitle>
				<EmptyDescription>
					アドレスが変わったか、間違っているようです。
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to="/">今日に戻る</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}
