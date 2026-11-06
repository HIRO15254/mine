import { env } from "@mine/env/web";
import { IconCheck, IconCopy, IconKey, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";

import { FormSheet } from "@/components/form-sheet/form-sheet";
import { ConfirmDeleteButton } from "@/components/tasks/confirm-delete-button";
import { Button } from "@/components/ui/button/button";
import { Field } from "@/components/ui/field/field";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { Input } from "@/components/ui/input/input";
import { useIsDesk } from "@/hooks/use-media-query";
import { trpc } from "@/utils/trpc";

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
	day: "numeric",
	month: "numeric",
	year: "numeric",
});

function formatDate(value: Date | string | null): string {
	return value ? dateFormat.format(new Date(value)) : "未使用";
}

/** Personal API tokens for apps such as HTTP Shortcuts. */
export function ApiTokenSettings() {
	const tokens = useQuery(trpc.token.list.queryOptions());
	const [sheet, setSheet] = useState({ key: 0, open: false });

	return (
		<div className="flex flex-col gap-2">
			<p className="m-0 text-muted-foreground text-xs">
				外部アプリからタイマーを操作するときに使います。API の URL は{" "}
				<code className="break-all font-mono">{env.VITE_SERVER_URL}/v1</code>
				です。
			</p>
			{tokens.data && tokens.data.length > 0 && (
				<ul className="m-0 flex list-none flex-col divide-y divide-border rounded-lg border border-border bg-card p-0">
					{tokens.data.map((token) => (
						<TokenRow key={token.id} token={token} />
					))}
				</ul>
			)}
			<Button
				className="self-start"
				onClick={() =>
					setSheet((current) => ({ key: current.key + 1, open: true }))
				}
				type="button"
				variant="secondary"
			>
				<IconPlus aria-hidden />
				トークンを発行
			</Button>
			<CreateTokenSheet
				key={sheet.key}
				onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
				open={sheet.open}
			/>
		</div>
	);
}

function TokenRow({
	token,
}: {
	token: {
		id: string;
		lastUsedAt: Date | string | null;
		name: string;
		prefix: string;
	};
}) {
	const queryClient = useQueryClient();
	const remove = useMutation(
		trpc.token.delete.mutationOptions({
			onSettled: () =>
				queryClient.invalidateQueries({ queryKey: trpc.token.pathKey() }),
		})
	);
	return (
		<li className="flex items-center gap-3 py-1.5 pr-1.5 pl-3">
			<IconKey aria-hidden className="size-4 shrink-0 text-muted-foreground" />
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm">{token.name}</span>
				<span className="truncate text-muted-foreground text-xs">
					<span className="font-mono">{token.prefix}…</span>
					・最終使用 {formatDate(token.lastUsedAt)}
				</span>
			</span>
			<ConfirmDeleteButton
				disabled={remove.isPending}
				onConfirm={() => remove.mutate({ id: token.id })}
			/>
		</li>
	);
}

function CreateTokenSheet({
	onOpenChange,
	open,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const formId = useId();
	const size = useIsDesk() ? "default" : "xl";
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [created, setCreated] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const create = useMutation(
		trpc.token.create.mutationOptions({
			onError: () => setError("発行できませんでした"),
			onSettled: () =>
				queryClient.invalidateQueries({ queryKey: trpc.token.pathKey() }),
			onSuccess: (result) => setCreated(result.token),
		})
	);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (created) {
			onOpenChange(false);
			return;
		}
		if (!name.trim()) {
			setError("名前を入力してください");
			return;
		}
		create.mutate({ name: name.trim() });
	};

	const copy = async () => {
		if (created) {
			await navigator.clipboard.writeText(created);
			setCopied(true);
		}
	};

	return (
		<FormSheet
			confirmLabel={created ? "閉じる" : "発行"}
			formId={formId}
			isSaving={create.isPending}
			onOpenChange={onOpenChange}
			open={open}
			title="トークンを発行"
		>
			<form className="flex flex-col gap-4" id={formId} onSubmit={submit}>
				{created ? (
					<div className="flex flex-col gap-2">
						<p className="m-0 text-sm">
							このトークンは今しか表示されません。コピーしてアプリに設定してください。
						</p>
						<div className="flex items-center gap-1.5">
							<Input
								aria-label="発行したトークン"
								className="font-mono"
								readOnly
								size={size}
								value={created}
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
				) : (
					<Field
						description="どのアプリで使うかがわかる名前にします"
						error={error}
						htmlFor={`${formId}-name`}
						label="名前"
						required
					>
						<Input
							autoComplete="off"
							id={`${formId}-name`}
							onChange={(event) => setName(event.target.value)}
							placeholder="HTTP Shortcuts"
							size={size}
							value={name}
						/>
					</Field>
				)}
			</form>
		</FormSheet>
	);
}
