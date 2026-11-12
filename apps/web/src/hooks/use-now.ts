import { useEffect, useState } from "react";

/**
 * The current time, refreshed every `everyMs` while `active`. Use a second
 * for a running clock and half a minute for anything shown to the minute.
 */
export function useNow(everyMs = 1000, active = true): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) {
			return;
		}
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), everyMs);
		return () => window.clearInterval(timer);
	}, [active, everyMs]);
	return now;
}
