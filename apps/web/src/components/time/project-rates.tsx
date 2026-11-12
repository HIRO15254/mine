import { IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button/button";
import { Field, FieldError } from "@/components/ui/field/field";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { Input } from "@/components/ui/input/input";
import { useControlSize } from "@/hooks/use-media-query";
import { formatDay, todayKey } from "@/lib/tasks";
import { formatYen } from "@/lib/time";
import { trpc } from "@/lib/trpc";

/** Hourly rates of one project; saved immediately, separate from its form. */
export function ProjectRates({
	hasParent,
	projectId,
}: {
	hasParent: boolean;
	projectId: string;
}) {
	const id = useId();
	const size = useControlSize();
	const today = todayKey();
	const queryClient = useQueryClient();
	const rates = useQuery(trpc.rate.list.queryOptions());
	const [day, setDay] = useState(today);
	const [amount, setAmount] = useState("");
	const [error, setError] = useState<string | null>(null);
	const invalidate = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: trpc.rate.pathKey() }),
			queryClient.invalidateQueries({ queryKey: trpc.time.summary.pathKey() }),
		]);
	const set = useMutation(
		trpc.rate.set.mutationOptions({
			onError: () => setError("単価を保存できませんでした"),
			onSettled: invalidate,
			onSuccess: () => {
				setAmount("");
				setError(null);
			},
		})
	);
	const remove = useMutation(
		trpc.rate.delete.mutationOptions({ onSettled: invalidate })
	);

	const own = (rates.data ?? [])
		.filter((rate) => rate.projectId === projectId)
		.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

	const add = () => {
		const hourlyRate = Number.parseInt(amount, 10);
		if (!(day && Number.isFinite(hourlyRate) && hourlyRate >= 0)) {
			setError("適用日と時給を入力してください");
			return;
		}
		set.mutate({ effectiveFrom: day, hourlyRate, projectId });
	};

	return (
		<section
			aria-labelledby={`${id}-title`}
			className="mt-5 flex flex-col gap-2 border-border border-t pt-4"
		>
			<h3 className="m-0 font-medium text-sm" id={`${id}-title`}>
				時給
			</h3>
			{own.length === 0 ? (
				<p className="m-0 text-muted-foreground text-xs">
					{hasParent
						? "未設定のときは親プロジェクトの時給を使います。"
						: "未設定です。"}
				</p>
			) : (
				<ul className="m-0 flex list-none flex-col divide-y divide-border rounded-md border border-border p-0">
					{own.map((rate) => (
						<li
							className="flex items-center gap-2 py-1 pr-1 pl-3 text-sm"
							key={rate.id}
						>
							<span className="min-w-0 flex-1 text-muted-foreground">
								{formatDay(rate.effectiveFrom, today)}から
							</span>
							<span className="tabular-nums">
								{formatYen(rate.hourlyRate)}/時間
							</span>
							<IconButton
								disabled={remove.isPending}
								label={`${rate.effectiveFrom}からの時給を削除`}
								onClick={() => remove.mutate({ id: rate.id })}
								size="sm"
							>
								<IconX aria-hidden />
							</IconButton>
						</li>
					))}
				</ul>
			)}
			<div className="flex items-end gap-1.5">
				<Field className="flex-1" htmlFor={`${id}-day`} label="適用日">
					<Input
						className="px-2"
						id={`${id}-day`}
						onChange={(event) => setDay(event.target.value)}
						size={size}
						type="date"
						value={day}
					/>
				</Field>
				<Field className="flex-1" htmlFor={`${id}-rate`} label="時給（円）">
					<Input
						id={`${id}-rate`}
						inputMode="numeric"
						min={0}
						onChange={(event) => setAmount(event.target.value)}
						size={size}
						type="number"
						value={amount}
					/>
				</Field>
				<Button
					disabled={set.isPending}
					onClick={add}
					size={size}
					type="button"
					variant="secondary"
				>
					<IconPlus aria-hidden />
					追加
				</Button>
			</div>
			{error && <FieldError>{error}</FieldError>}
		</section>
	);
}
