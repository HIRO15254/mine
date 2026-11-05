import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const rootSpy = vi.hoisted(() => vi.fn());

vi.mock("vaul", () => ({
	Drawer: {
		Close: ({ children }: { children?: ReactNode }) => children ?? null,
		Content: ({ children }: { children?: ReactNode }) => children ?? null,
		Description: ({ children }: { children?: ReactNode }) => children ?? null,
		Overlay: () => null,
		Portal: ({ children }: { children?: ReactNode }) => children ?? null,
		Root: (props: { children?: ReactNode }) => {
			rootSpy(props);
			return props.children ?? null;
		},
		Title: ({ children }: { children?: ReactNode }) => children ?? null,
		Trigger: ({ children }: { children?: ReactNode }) => children ?? null,
	},
}));

import { Drawer } from "../drawer";

describe("Drawer", () => {
	it("disables vaul's repositionInputs by default", () => {
		rootSpy.mockClear();
		render(
			<Drawer onOpenChange={vi.fn()} open>
				<div>content</div>
			</Drawer>
		);
		const props = rootSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
		expect(props.repositionInputs).toBe(false);
	});
});
