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
