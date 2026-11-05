import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button/button";
import { useIsDesk } from "@/hooks/use-media-query";

/** Deletes on the second press, so one stray tap cannot lose data. */
export function ConfirmDeleteButton({
	disabled = false,
	onConfirm,
}: {
	disabled?: boolean;
	onConfirm: () => void;
}) {
	const isDesk = useIsDesk();
	const [armed, setArmed] = useState(false);
	return (
		<Button
			disabled={disabled}
			onBlur={() => setArmed(false)}
			onClick={() => (armed ? onConfirm() : setArmed(true))}
			size={isDesk ? "default" : "xl"}
			type="button"
			variant={armed ? "destructive" : "ghost"}
		>
			<IconTrash aria-hidden />
			{armed ? "もう一度押して削除" : "削除"}
		</Button>
	);
}
