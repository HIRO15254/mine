import { env } from "@mine/env/web";
import {
	IconCheck,
	IconCopy,
	IconLayoutDashboard,
	IconRefresh,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteButton } from "@/components/tasks/confirm-delete-button";
import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { Input } from "@/components/ui/input/input";
import { useControlSize } from "@/hooks/use-media-query";
import { trpc } from "@/lib/trpc";

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	month: "numeric",
});

/** The address an Android widget app loads; the secret is its sign-in. */
export function widgetUrl(token: string): string {
	return `${env.VITE_SERVER_URL}/widget/${token}`;
}

/**
 * The secret link to the home-screen widget page. Like an API token, the
 * link is shown once; issuing again replaces it.
 */
export function WidgetSettings() {
	const size = useControlSize();
	const queryClient = useQueryClient();
	const link = useQuery(trpc.widget.link.queryOptions());
	const [issued, setIssued] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: trpc.widget.pathKey() });
	const issue = useMutation(
		trpc.widget.issue.mutationOptions({
			onSettled: refresh,
			onSuccess: (result) => {
				setIssued(widgetUrl(result.token));
				setCopied(false);
			},
		})
	);
	const revoke = useMutation(
		trpc.widget.revoke.mutationOptions({
			onSettled: refresh,
			onSuccess: () => setIssued(null),
		})
	);

	const copy = async () => {
		if (!issued) {
			return;
		}
		try {
			await navigator.clipboard.writeText(issued);
			setCopied(true);
		} catch {
			toast.error("コピーできませんでした", {
				description: "URL を選択してコピーしてください",
			});
		}
	};

	const current = link.data;
	return (
		<div className="flex flex-col gap-2">
			<p className="m-0 text-muted-foreground text-xs">
				{
					"Android のホーム画面に今日の予定・タスク・タイマーを表示するページです。HTML Widget などのアプリに URL を設定します。KWGT など JSON を読むアプリには、末尾に .json を付けた URL を使います。URL を知っている人は誰でも見られるので、共有しないでください。"
				}
			</p>
			{issued && (
				<div className="flex flex-col gap-1.5">
					<p className="m-0 text-sm">
						この URL
						は今しか表示されません。コピーしてアプリに設定してください。
					</p>
					<div className="flex items-center gap-1.5">
						<Input
							aria-label="ウィジェットの URL"
							className="font-mono"
							readOnly
							size={size}
							value={issued}
						/>
						<IconButton
							label={copied ? "コピーしました" : "コピー"}
							onClick={copy}
							size={size === "xl" ? "xl" : "md"}
							type="button"
							variant="outline"
						>
							{copied ? <IconCheck aria-hidden /> : <IconCopy aria-hidden />}
						</IconButton>
					</div>
				</div>
			)}
			{current && (
				<div className="flex items-center gap-3 rounded-lg border border-border bg-card py-1.5 pr-1.5 pl-3">
					<IconLayoutDashboard
						aria-hidden
						className="size-4 shrink-0 text-muted-foreground"
					/>
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="truncate text-sm">ウィジェットの URL</span>
						<span className="truncate text-muted-foreground text-xs">
							<span className="font-mono">{current.prefix}…</span>
							・最終表示{" "}
							{current.lastUsedAt === null
								? "まだありません"
								: dateFormat.format(new Date(current.lastUsedAt))}
						</span>
					</span>
					<ConfirmDeleteButton
						disabled={revoke.isPending}
						onConfirm={() => revoke.mutate()}
					/>
				</div>
			)}
			<Button
				className="self-start"
				disabled={issue.isPending || link.isPending}
				onClick={() => issue.mutate()}
				type="button"
				variant="secondary"
			>
				<IconRefresh aria-hidden />
				{current ? "URL を再発行" : "URL を発行"}
			</Button>
			{current && (
				<p className="m-0 text-muted-foreground text-xs">
					再発行すると、今の URL は使えなくなります。
				</p>
			)}
		</div>
	);
}
