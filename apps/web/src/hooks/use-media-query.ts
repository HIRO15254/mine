import { useEffect, useState } from "react";

function matches(query: string): boolean {
	return typeof window !== "undefined" &&
		typeof window.matchMedia === "function"
		? window.matchMedia(query).matches
		: false;
}

export function useMediaQuery(query: string): boolean {
	const [value, setValue] = useState(() => matches(query));

	useEffect(() => {
		if (typeof window.matchMedia !== "function") {
			return;
		}
		const media = window.matchMedia(query);
		setValue(media.matches);
		const listener = (event: MediaQueryListEvent) => setValue(event.matches);
		media.addEventListener("change", listener);
		return () => media.removeEventListener("change", listener);
	}, [query]);

	return value;
}

/** True at the `desk` breakpoint (720px) and above. */
export function useIsDesk(): boolean {
	return useMediaQuery("(min-width: 45rem)");
}
