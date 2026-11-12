import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/** The heights of an hour the zoom buttons step through, above the fitted scale. */
export const HOUR_STEPS = [32, 40, 48, 56, 72, 96, 128] as const;
export const MAX_HOUR = HOUR_STEPS.at(-1) ?? 128;
/** The smallest scale before the screen has been measured, as in tests. */
export const UNMEASURED_MIN_HOUR = 24;
/** Never smaller than this, however short the window. */
const FLOOR_HOUR = 16;
const DEFAULT_HOUR = { desk: 48, phone: 56 } as const;
const STORAGE_KEY = "mine-calendar-hour";
/** Saved in place of a number for the smallest scale, which depends on the screen. */
const FIT = "fit";

type Layout = keyof typeof DEFAULT_HOUR;
type Saved = number | typeof FIT;

export function clampHour(height: number, min: number): number {
	return Math.min(Math.max(Math.round(height), min), MAX_HOUR);
}

/** The next stop in a direction: the steps above `min`, and `min` itself at the bottom. */
export function stepHour(
	height: number,
	direction: 1 | -1,
	min: number
): number {
	if (direction > 0) {
		return HOUR_STEPS.find((step) => step > height && step > min) ?? MAX_HOUR;
	}
	return HOUR_STEPS.findLast((step) => step < height && step > min) ?? min;
}

/**
 * The height of an hour at which the whole day fits below the grid's sticky
 * rows, or null before it can be measured.
 */
export function fittedHour(
	visibleHeight: number,
	stickyTop: number,
	headHeight: number
): number | null {
	const room = visibleHeight - stickyTop - headHeight;
	if (room <= 0) {
		return null;
	}
	return Math.min(Math.max(room / 24, FLOOR_HOUR), MAX_HOUR);
}

function readSaved(layout: Layout): Saved {
	try {
		const saved = JSON.parse(
			window.localStorage.getItem(STORAGE_KEY) ?? "{}"
		) as Partial<Record<Layout, unknown>>;
		const value = saved[layout];
		if (value === FIT) {
			return FIT;
		}
		return typeof value === "number" && Number.isFinite(value)
			? value
			: DEFAULT_HOUR[layout];
	} catch {
		return DEFAULT_HOUR[layout];
	}
}

function save(layout: Layout, height: Saved) {
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

/** How far the scale may be from the fitted one and still count as it. */
const FIT_TOLERANCE = 0.5;

/** The grid's sticky rows sit right before the hours. */
function measureFit(body: HTMLElement): number | null {
	const head = body.previousElementSibling;
	if (!(head instanceof HTMLElement)) {
		return null;
	}
	return fittedHour(
		scrollParent(body).clientHeight,
		Number.parseFloat(getComputedStyle(head).top) || 0,
		head.offsetHeight
	);
}

/**
 * The calendar's time scale: the height of an hour, kept per layout in this
 * browser. It goes down only to where the whole day fits on the screen, which
 * is measured and saved as "fit" rather than as a number. Changing it keeps
 * the time under the pointer (or in the middle of the screen) where it was.
 */
export function useHourZoom(isDesk: boolean): HourZoom {
	const layout: Layout = isDesk ? "desk" : "phone";
	const [saved, setSaved] = useState(() => ({
		desk: readSaved("desk"),
		phone: readSaved("phone"),
	}));
	const [element, setElement] = useState<HTMLDivElement | null>(null);
	const [fit, setFit] = useState<number | null>(null);
	const min = fit ?? UNMEASURED_MIN_HOUR;
	const chosen = saved[layout];
	const hourHeight = chosen === FIT ? min : clampHour(chosen, min);

	const body = useRef<HTMLDivElement | null>(null);
	const focus = useRef<Focus | null>(null);
	// The scale asked for last, and the scale the grid is drawn at: they differ
	// between a change and the next render, as during a pinch.
	const current = useRef(hourHeight);
	const drawn = useRef(hourHeight);
	const minRef = useRef(min);
	minRef.current = min;

	const zoomTo = useCallback(
		(next: number, clientY?: number) => {
			const element = body.current;
			const height = clampHour(next, minRef.current);
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
			const value: Saved =
				height - minRef.current < FIT_TOLERANCE ? FIT : height;
			setSaved((all) => ({ ...all, [layout]: value }));
			save(layout, value);
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

	const bodyRef = useCallback((node: HTMLDivElement | null) => {
		body.current = node;
		setElement(node);
	}, []);

	// Measure what fits now and whenever the window or the sticky rows change size.
	useLayoutEffect(() => {
		if (!element) {
			return;
		}
		const measure = () => setFit(measureFit(element));
		measure();
		if (typeof ResizeObserver === "undefined") {
			return;
		}
		const observer = new ResizeObserver(measure);
		observer.observe(scrollParent(element));
		const head = element.previousElementSibling;
		if (head) {
			observer.observe(head);
		}
		return () => observer.disconnect();
	}, [element]);

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
		canZoomOut: hourHeight > min,
		hourHeight,
		zoomIn: () => zoomTo(stepHour(hourHeight, 1, min)),
		zoomOut: () => zoomTo(stepHour(hourHeight, -1, min)),
	};
}
