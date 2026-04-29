import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	useMediaQuery: vi.fn(),
}));

vi.mock("@/shared/hooks/use-media-query", () => ({
	useMediaQuery: mocks.useMediaQuery,
}));

import {
	DESKTOP_BREAKPOINT,
	useCurrentDevice,
} from "@/features/dashboard/hooks/use-current-device";

describe("useCurrentDevice", () => {
	beforeEach(() => {
		mocks.useMediaQuery.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("forwards the DESKTOP_BREAKPOINT constant to useMediaQuery", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		renderHook(() => useCurrentDevice());
		expect(mocks.useMediaQuery).toHaveBeenCalledTimes(1);
		expect(mocks.useMediaQuery).toHaveBeenCalledWith(DESKTOP_BREAKPOINT);
	});

	it("returns 'desktop' when useMediaQuery reports a match", () => {
		mocks.useMediaQuery.mockReturnValue(true);
		const { result } = renderHook(() => useCurrentDevice());
		expect(result.current).toBe("desktop");
	});

	it("returns 'mobile' when useMediaQuery reports no match", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		const { result } = renderHook(() => useCurrentDevice());
		expect(result.current).toBe("mobile");
	});

	it("re-evaluates the return value when useMediaQuery result changes across renders", () => {
		mocks.useMediaQuery.mockReturnValueOnce(false).mockReturnValueOnce(true);
		const { result, rerender } = renderHook(() => useCurrentDevice());
		expect(result.current).toBe("mobile");
		rerender();
		expect(result.current).toBe("desktop");
	});

	it("exposes DESKTOP_BREAKPOINT as the 768px min-width media query", () => {
		expect(DESKTOP_BREAKPOINT).toBe("(min-width: 768px)");
	});
});
