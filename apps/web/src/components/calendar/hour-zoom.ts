import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/** The heights of an hour the zoom buttons step through, in pixels. */
export const HOUR_STEPS = [24, 32, 40, 48, 56, 72, 96, 128] as const;
export const MIN_HOUR = HOUR_STEPS[0];
export const MAX_HOUR = HOUR_STEPS.at(-1) ?? 128;
const DEFAULT_HOUR = { desk: 48, phone: 56 } as const;
const STORAGE_KEY = "mine-calendar-hour";

type Layout = keyof typeof DEFAULT_HOUR;

export function clampHour(height: number): number {
	return Math.round(Math.min(Math.max(height, MIN_HOUR), MAX_HOUR));
}

/** The next step in a direction from any height, or the same height at the end. */
export function stepHour(height: number, direction: 1 | -1): number {
	if (direction > 0) {
		return HOUR_STEPS.find((step) => step > height) ?? MAX_HOUR;
	}
	return HOUR_STEPS.findLast((step) => step < height) ?? MIN_HOUR;
}

function readSaved(layout: Layout): number {
	try {
		const saved = JSON.parse(
			window.localStorage.getItem(STORAGE_KEY) ?? "{}"
		) as Partial<Record<Layout, unknown>>;
		const value = saved[layout];
		return typeof value === "number" && Number.isFinite(value)
			? clampHour(value)
			: DEFAULT_HOUR[layout];
	} catch {
		return DEFAULT_HOUR[layout];
	}
}

function save(layout: Layout, height: number) {
	try {
		const saved = JSON.parse(
			window.localStorage.getItem(STORAGE_KEY) ?? "{}"
		) as Record<string, unknown>;
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ ...saved, [layout]: height })
		);
	} catch {
		// Without storage the scale lasts until the page closes.
	}
}

function scrollParent(element: HTMLElement): HTMLElement {
	let node = element.parentElement;
	while (node) {
		const { overflowY } = getComputedStyle(node);
		if (overflowY === "auto" || overflowY === "scroll") {
			return node;
		}
		node = node.parentElement;
	}
	return (document.scrollingElement as HTMLElement | null) ?? document.body;
}

/** The point to keep in place while the scale changes. */
interface Focus {
	clientY: number;
	minutes: number;
}

export interface HourZoom {
	/** Put on the hours: ctrl + wheel (or a trackpad pinch) and a two-finger pinch zoom it. */
	bodyRef: (element: HTMLDivElement | null) => void;
	canZoomIn: boolean;
	canZoomOut: boolean;
	hourHeight: number;
	zoomIn: () => void;
	zoomOut: () => void;
}

const WHEEL_SPEED = 0.01;

/**
 * The calendar's time scale: the height of an hour, kept per layout in this
 * browser. Changing it keeps the time under the pointer (or in the middle of
 * the screen) where it was.
 */
export function useHourZoom(isDesk: boolean): HourZoom {
	const layout: Layout = isDesk ? "desk" : "phone";
	const [heights, setHeights] = useState(() => ({
		desk: readSaved("desk"),
		phone: readSaved("phone"),
	}));
	const hourHeight = heights[layout];
	const body = useRef<HTMLDivElement | null>(null);
	const focus = useRef<Focus | null>(null);
	// The scale asked for last, and the scale the grid is drawn at: they differ
	// between a change and the next render, as during a pinch.
	const current = useRef(hourHeight);
	const drawn = useRef(hourHeight);

	const zoomTo = useCallback(
		(next: number, clientY?: number) => {
			const element = body.current;
			const height = clampHour(next);
			if (height === current.current) {
				return;
			}
			if (element) {
				const rect = element.getBoundingClientRect();
				const view = scrollParent(element).getBoundingClientRect();
				const y =
					clientY ??
					(Math.max(rect.top, view.top) + Math.min(rect.bottom, view.bottom)) /
						2;
				focus.current = {
					clientY: y,
					minutes: ((y - rect.top) / drawn.current) * 60,
				};
			}
			current.current = height;
			setHeights((all) => ({ ...all, [layout]: height }));
			save(layout, height);
		},
		[layout]
	);

	// After the grid is drawn at the new scale, scroll the focus back under itself.
	useLayoutEffect(() => {
		drawn.current = hourHeight;
		current.current = hourHeight;
		const element = body.current;
		const kept = focus.current;
		focus.current = null;
		if (!(element && kept)) {
			return;
		}
		const top = element.getBoundingClientRect().top;
		const shift = top + (kept.minutes / 60) * hourHeight - kept.clientY;
		scrollParent(element).scrollTop += shift;
	}, [hourHeight]);

	const [element, setElement] = useState<HTMLDivElement | null>(null);
	const bodyRef = useCallback((node: HTMLDivElement | null) => {
		body.current = node;
		setElement(node);
	}, []);

	useEffect(() => {
		if (!element) {
			return;
		}
		// ctrl + wheel, which is also what a trackpad pinch sends.
		const wheel = (event: WheelEvent) => {
			if (!(event.ctrlKey || event.metaKey)) {
				return;
			}
			event.preventDefault();
			zoomTo(
				current.current * Math.exp(-event.deltaY * WHEEL_SPEED),
				event.clientY
			);
		};
		let pinch: { distance: number; height: number } | null = null;
		const spread = (touches: TouchList) => {
			const [a, b] = [touches[0], touches[1]];
			return a && b
				? {
						distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
						middle: (a.clientY + b.clientY) / 2,
					}
				: null;
		};
		const touchStart = (event: TouchEvent) => {
			const now = spread(event.touches);
			pinch =
				event.touches.length === 2 && now && now.distance > 0
					? { distance: now.distance, height: current.current }
					: null;
		};
		const touchMove = (event: TouchEvent) => {
			const now = spread(event.touches);
			if (!(pinch && now && event.touches.length === 2)) {
				return;
			}
			event.preventDefault();
			zoomTo(pinch.height * (now.distance / pinch.distance), now.middle);
		};
		const touchEnd = (event: TouchEvent) => {
			if (event.touches.length < 2) {
				pinch = null;
			}
		};
		element.addEventListener("wheel", wheel, { passive: false });
		element.addEventListener("touchstart", touchStart, { passive: true });
		element.addEventListener("touchmove", touchMove, { passive: false });
		element.addEventListener("touchend", touchEnd);
		element.addEventListener("touchcancel", touchEnd);
		return () => {
			element.removeEventListener("wheel", wheel);
			element.removeEventListener("touchstart", touchStart);
			element.removeEventListener("touchmove", touchMove);
			element.removeEventListener("touchend", touchEnd);
			element.removeEventListener("touchcancel", touchEnd);
		};
	}, [element, zoomTo]);

	return {
		bodyRef,
		canZoomIn: hourHeight < MAX_HOUR,
		canZoomOut: hourHeight > MIN_HOUR,
		hourHeight,
		zoomIn: () => zoomTo(stepHour(hourHeight, 1)),
		zoomOut: () => zoomTo(stepHour(hourHeight, -1)),
	};
}
