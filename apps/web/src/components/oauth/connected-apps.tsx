import { env } from "@mine/env/web";
import { IconPlugConnected } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDeleteButton } from "@/components/tasks/confirm-delete-button";
import { trpc } from "@/utils/trpc";

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
	day: "numeric",
	month: "numeric",
	year: "numeric",
});

function formatDate(value: Date | string | null): string {
	return value ? dateFormat.format(new Date(value)) : "未使用";
}

/** Apps such as Claude that signed in through OAuth to use the MCP server. */
export function ConnectedApps() {
	const connections = useQuery(trpc.oauth.connections.queryOptions());

	return (
		<div className="flex flex-col gap-2">
			<p className="m-0 text-muted-foreground text-xs">
				Claude のカスタムコネクタに{" "}
				<code className="break-all font-mono">{env.VITE_SERVER_URL}/mcp</code>{" "}
				を追加すると、Claude からタスクや記録を操作できます。
			</p>
			{connections.data && connections.data.length === 0 && (
				<p className="m-0 text-muted-foreground text-sm">
					接続しているアプリはありません
				</p>
			)}
			{connections.data && connections.data.length > 0 && (
				<ul className="m-0 flex list-none flex-col divide-y divide-border rounded-lg border border-border bg-card p-0">
					{connections.data.map((connection) => (
						<ConnectionRow connection={connection} key={connection.id} />
					))}
				</ul>
			)}
		</div>
	);
}

function ConnectionRow({
	connection,
}: {
	connection: {
		createdAt: Date | string;
		id: string;
		lastUsedAt: Date | string | null;
		name: string;
	};
}) {
	const queryClient = useQueryClient();
	const revoke = useMutation(
		trpc.oauth.revoke.mutationOptions({
			onSettled: () =>
				queryClient.invalidateQueries({ queryKey: trpc.oauth.pathKey() }),
		})
	);
	return (
		<li className="flex items-center gap-3 py-1.5 pr-1.5 pl-3">
			<IconPlugConnected
				aria-hidden
				className="size-4 shrink-0 text-muted-foreground"
			/>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm">{connection.name}</span>
				<span className="truncate text-muted-foreground text-xs">
					{formatDate(connection.createdAt)} に接続・最終使用{" "}
					{formatDate(connection.lastUsedAt)}
				</span>
			</span>
			<ConfirmDeleteButton
				disabled={revoke.isPending}
				onConfirm={() => revoke.mutate({ id: connection.id })}
			/>
		</li>
	);
}
