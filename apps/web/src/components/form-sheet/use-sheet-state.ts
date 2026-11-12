import { useState } from "react";

/**
 * Open and closed state for an editor sheet. `show(value)` opens it for a
 * value (the row to edit, or what a new one starts from); `key` changes on
 * every open, so passing it as the sheet's `key` starts the form fresh.
 */
export function useSheetState<Value>(initial: Value) {
	const [state, setState] = useState({ key: 0, open: false, value: initial });
	return {
		key: state.key,
		open: state.open,
		setOpen: (open: boolean) => setState((current) => ({ ...current, open })),
		show: (value: Value) =>
			setState((current) => ({ key: current.key + 1, open: true, value })),
		value: state.value,
	};
}
