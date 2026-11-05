import { useId } from "react";

export function useField() {
	const id = useId();

	return {
		hintId: `field-hint-${id.replaceAll(":", "")}`,
	};
}
