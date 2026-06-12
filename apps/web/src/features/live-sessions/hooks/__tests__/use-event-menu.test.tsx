import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
	EventMenuProvider,
	useEventMenu,
} from "@/features/live-sessions/hooks/use-event-menu";

const wrapper = ({ children }: { children: ReactNode }) => (
	<EventMenuProvider>{children}</EventMenuProvider>
);

describe("useEventMenu", () => {
	it("starts closed", () => {
		const { result } = renderHook(() => useEventMenu(), { wrapper });
		expect(result.current.isOpen).toBe(false);
	});

	it("open() sets isOpen to true", () => {
		const { result } = renderHook(() => useEventMenu(), { wrapper });
		act(() => result.current.open());
		expect(result.current.isOpen).toBe(true);
	});

	it("close() sets isOpen back to false", () => {
		const { result } = renderHook(() => useEventMenu(), { wrapper });
		act(() => result.current.open());
		act(() => result.current.close());
		expect(result.current.isOpen).toBe(false);
	});

	it("close() on an already-closed menu keeps it closed", () => {
		const { result } = renderHook(() => useEventMenu(), { wrapper });
		act(() => result.current.close());
		expect(result.current.isOpen).toBe(false);
	});

	it("setIsOpen(true) / setIsOpen(false) drive the open state", () => {
		const { result } = renderHook(() => useEventMenu(), { wrapper });
		act(() => result.current.setIsOpen(true));
		expect(result.current.isOpen).toBe(true);
		act(() => result.current.setIsOpen(false));
		expect(result.current.isOpen).toBe(false);
	});

	it("shares one open state across consumers under the same provider", () => {
		const { result } = renderHook(
			() => ({ first: useEventMenu(), second: useEventMenu() }),
			{ wrapper }
		);
		act(() => result.current.first.open());
		expect(result.current.second.isOpen).toBe(true);
	});

	it("throws when used outside EventMenuProvider", () => {
		expect(() => renderHook(() => useEventMenu())).toThrow(
			"useEventMenu must be used within EventMenuProvider"
		);
	});
});
