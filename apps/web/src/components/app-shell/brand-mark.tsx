import { cn } from "@/lib/utils";

/**
 * The Mine mark (a white crystal on black). Light themes show it inverted
 * through the `brand-mark` class in index.css. Decorative: the name "Mine"
 * or the page title always sits beside it.
 */
export function BrandMark({
	className,
	size,
}: {
	className?: string;
	size: number;
}) {
	return (
		<img
			alt=""
			aria-hidden
			className={cn("brand-mark shrink-0 rounded-[22%]", className)}
			height={size}
			src="/logo.png"
			width={size}
		/>
	);
}
