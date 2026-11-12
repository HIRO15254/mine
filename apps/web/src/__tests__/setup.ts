import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
	cleanup();
	// Undoes freezeNow(); a no-op when the test left the clock alone.
	vi.useRealTimers();
});

// Radix measures some controls (e.g. Switch); jsdom has no ResizeObserver.
if (!("ResizeObserver" in globalThis)) {
	globalThis.ResizeObserver = class {
		disconnect() {
			// jsdom never resizes
		}
		observe() {
			// jsdom never resizes
		}
		unobserve() {
			// jsdom never resizes
		}
	};
}

// Toasts and sliders capture the pointer; jsdom has no pointer capture.
if (!("setPointerCapture" in Element.prototype)) {
	Object.assign(Element.prototype, {
		hasPointerCapture: () => false,
		releasePointerCapture: () => undefined,
		setPointerCapture: () => undefined,
	});
}

// The week planner scrolls to the current hour; jsdom lays nothing out.
if (!("scrollIntoView" in Element.prototype)) {
	Object.assign(Element.prototype, { scrollIntoView: () => undefined });
}
