import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	useMediaQuery: vi.fn(),
}));

vi.mock("@/shared/hooks/use-media-query", () => ({
	useMediaQuery: mocks.useMediaQuery,
}));

import { useAuthenticatedShell } from "@/shared/components/authenticated-shell/use-authenticated-shell";

describe("useAuthenticatedShell", () => {
	beforeEach(() => {
		mocks.useMediaQuery.mockReset();
	});

	it("queries the 768px-min desktop breakpoint", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		renderHook(() => useAuthenticatedShell());
		expect(mocks.useMediaQuery).toHaveBeenCalledTimes(1);
		expect(mocks.useMediaQuery).toHaveBeenCalledWith("(min-width: 768px)");
	});

	it("returns isDesktop=true when the media query matches", () => {
		mocks.useMediaQuery.mockReturnValue(true);
		const { result } = renderHook(() => useAuthenticatedShell());
		expect(result.current).toEqual({ isDesktop: true });
	});

	it("returns isDesktop=false when the media query does not match", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		const { result } = renderHook(() => useAuthenticatedShell());
		expect(result.current).toEqual({ isDesktop: false });
	});
});
