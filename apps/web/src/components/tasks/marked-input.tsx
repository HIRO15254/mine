import {
	type ComponentProps,
	type CSSProperties,
	type ReactNode,
	type Ref,
	useLayoutEffect,
	useRef,
} from "react";

import { Input } from "@/components/ui/input/input";
import { cn } from "@/lib/utils";

/** A stretch of the typed text drawn as a chip. */
export interface TextMark {
	/** A CSS color for the chip; null dims the text instead. */
	color: string | null;
	end: number;
	/** What the stretch is, for tests and styles ("project", "date", ...). */
	kind?: string;
	projectId?: string;
	start: number;
}

/** The text with each mark drawn in its color, or dimmed without one. */
function MarkedText({ marks, text }: { marks: TextMark[]; text: string }) {
	const parts: ReactNode[] = [];
	let from = 0;
	for (const item of [...marks].sort((a, b) => a.start - b.start)) {
		if (item.start < from) {
			continue;
		}
		parts.push(text.slice(from, item.start));
		const word = text.slice(item.start, item.end);
		parts.push(
			item.color ? (
				<mark
					className="rounded-[3px] bg-[color-mix(in_srgb,var(--c)_22%,transparent)] text-[color-mix(in_srgb,var(--c)_75%,var(--foreground))] shadow-[0_0_0_2px_color-mix(in_srgb,var(--c)_22%,transparent)]"
					data-kind={item.kind}
					data-project={item.projectId}
					key={item.start}
					style={{ "--c": item.color } as CSSProperties}
				>
					{word}
				</mark>
			) : (
				<span className="text-muted-foreground" key={item.start}>
					{word}
				</span>
			)
		);
		from = item.end;
	}
	parts.push(text.slice(from));
	return <>{parts}</>;
}

/**
 * A one-line input whose text is drawn by a copy laid over it, so parts of
 * it can be marked: "#研究" in its project's hue, "明日" as a chip. The
 * input keeps the caret and the selection; its own text is transparent.
 */
export function MarkedInput({
	className,
	marks,
	onScroll,
	onSelect,
	ref,
	size,
	value,
	...props
}: Omit<ComponentProps<typeof Input>, "value"> & {
	marks: TextMark[];
	ref?: Ref<HTMLInputElement>;
	value: string;
}) {
	const input = useRef<HTMLInputElement | null>(null);
	const mirror = useRef<HTMLDivElement>(null);
	const sync = () => {
		if (mirror.current && input.current) {
			mirror.current.scrollLeft = input.current.scrollLeft;
		}
	};
	// The input scrolls as text is typed or completed past its width.
	useLayoutEffect(sync);

	const setRef = (node: HTMLInputElement | null) => {
		input.current = node;
		if (typeof ref === "function") {
			ref(node);
		} else if (ref) {
			ref.current = node;
		}
	};

	return (
		<div className="relative min-w-0 flex-1">
			<Input
				className={cn(
					"text-transparent caret-foreground selection:bg-primary-soft selection:text-transparent",
					className
				)}
				onScroll={(event) => {
					sync();
					onScroll?.(event);
				}}
				onSelect={(event) => {
					sync();
					onSelect?.(event);
				}}
				ref={setRef}
				size={size}
				value={value}
				{...props}
			/>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-px flex items-center overflow-hidden whitespace-pre px-2.5 text-foreground",
					size === "xl" ? "text-[length:var(--m-text-body)]" : "text-sm"
				)}
				data-slot="marked-input-mirror"
				ref={mirror}
			>
				<span className="shrink-0">
					<MarkedText marks={marks} text={value} />
				</span>
			</div>
		</div>
	);
}
