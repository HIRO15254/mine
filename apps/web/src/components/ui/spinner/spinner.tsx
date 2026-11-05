import { IconLoader2 } from "@tabler/icons-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			aria-label="Loading"
			className={cn("inline-flex animate-spin", className)}
			data-slot="spinner"
			role="status"
			{...props}
		>
			<IconLoader2 aria-hidden className="size-4" />
		</span>
	);
}

export { Spinner };
