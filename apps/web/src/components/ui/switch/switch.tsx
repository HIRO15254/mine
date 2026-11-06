import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** Toggle for settings that apply immediately. `xl` is the 40×24 mobile size. */
function Switch({
	className,
	size = "default",
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
	size?: "default" | "xl";
}) {
	return (
		<SwitchPrimitive.Root
			className={cn(
				"group/switch inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 outline-none transition-colors duration-[var(--duration-base)] focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[size=xl]:h-6 data-[size=xl]:w-10 data-[state=checked]:bg-primary",
				className
			)}
			data-size={size}
			data-slot="switch"
			{...props}
		>
			<SwitchPrimitive.Thumb className="pointer-events-none block size-3 rounded-full bg-switch-thumb shadow-[var(--shadow-sm)] transition-transform duration-[var(--duration-base)] data-[state=checked]:translate-x-3 data-[state=checked]:bg-primary-foreground group-data-[size=xl]/switch:size-5 group-data-[size=xl]/switch:data-[state=checked]:translate-x-4" />
		</SwitchPrimitive.Root>
	);
}

export { Switch };
