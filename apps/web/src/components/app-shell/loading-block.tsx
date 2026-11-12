import { Spinner } from "@/components/ui/spinner/spinner";
import { cn } from "@/lib/utils";

/** A centered spinner standing in for a section that is still loading. */
export function LoadingBlock({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex justify-center py-8 text-muted-foreground",
				className
			)}
		>
			<Spinner />
		</div>
	);
}
