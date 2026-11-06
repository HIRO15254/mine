import { IconPlugConnected } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert/alert";
import { Button } from "@/components/ui/button/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card/card";
import { Spinner } from "@/components/ui/spinner/spinner";
import { type AuthorizeRequest, deniedRedirect } from "@/lib/oauth";
import { trpc } from "@/utils/trpc";

const ABILITIES = [
	"タスクの確認・追加・変更・完了・削除",
	"タイマーの操作と記録の追加・集計",
	"プロジェクトとラベルの確認",
	"表示しているカレンダーの予定の確認",
];

function leave(url: string) {
	window.location.assign(url);
}

function Problem({ message }: { message: string }) {
	return (
		<Alert variant="destructive">
			<AlertTitle>接続できません</AlertTitle>
			<AlertDescription>{message}</AlertDescription>
		</Alert>
	);
}

export function ConsentCard({
	navigate = leave,
	request,
}: {
	/** Sends the browser back to the app; replaceable in tests. */
	navigate?: (url: string) => void;
	request: AuthorizeRequest | { error: string };
}) {
	if ("error" in request) {
		return <Problem message={request.error} />;
	}
	return <Consent navigate={navigate} request={request} />;
}

function Consent({
	navigate,
	request,
}: {
	navigate: (url: string) => void;
	request: AuthorizeRequest;
}) {
	const client = useQuery(
		trpc.oauth.client.queryOptions(
			{ clientId: request.clientId, redirectUri: request.redirectUri },
			{ retry: false }
		)
	);
	const approve = useMutation(
		trpc.oauth.approve.mutationOptions({
			onSuccess: (result) => navigate(result.redirectUrl),
		})
	);

	if (client.isPending) {
		return (
			<div className="flex justify-center py-8 text-muted-foreground">
				<Spinner />
			</div>
		);
	}
	if (client.isError) {
		return (
			<Problem message="このアプリは登録されていないか、戻り先が違います" />
		);
	}

	const busy = approve.isPending || approve.isSuccess;
	return (
		<Card>
			<CardHeader>
				<IconPlugConnected aria-hidden />
				<CardTitle>{client.data.name} を接続</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="m-0 text-sm">
					許可すると、{client.data.name} が次のことをできるようになります。
				</p>
				<ul className="m-0 flex flex-col gap-1 pl-5 text-sm">
					{ABILITIES.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
				<p className="m-0 text-muted-foreground text-xs">
					戻り先: <span className="font-mono">{client.data.redirectHost}</span>
					。接続は設定の「Claude との接続」からいつでも解除できます。
				</p>
				{approve.isError && <Problem message="許可できませんでした" />}
				<div className="flex flex-wrap justify-end gap-2">
					<Button
						disabled={busy}
						onClick={() =>
							navigate(deniedRedirect(request.redirectUri, request.state))
						}
						type="button"
						variant="outline"
					>
						拒否
					</Button>
					<Button
						disabled={busy}
						onClick={() =>
							approve.mutate({
								clientId: request.clientId,
								codeChallenge: request.codeChallenge,
								redirectUri: request.redirectUri,
								scope: request.scope,
								state: request.state,
							})
						}
						type="button"
					>
						{busy && <Spinner />}
						許可
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
