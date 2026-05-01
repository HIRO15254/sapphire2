import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	hasActive: false,
	isLoading: false,
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => ({
		hasActive: mocks.hasActive,
		isLoading: mocks.isLoading,
	}),
}));

import { useHomePage } from "@/routes/-use-home-page";

describe("useHomePage", () => {
	beforeEach(() => {
		mocks.hasActive = false;
		mocks.isLoading = false;
		mocks.navigate.mockClear();
	});

	describe("isLoading", () => {
		it("returns true while active session is loading", () => {
			mocks.isLoading = true;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isLoading).toBe(true);
		});

		it("returns false when active session loaded", () => {
			mocks.isLoading = false;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isLoading).toBe(false);
		});
	});

	describe("redirect behaviour", () => {
		it("does not navigate while loading", () => {
			mocks.isLoading = true;
			renderHook(() => useHomePage());
			expect(mocks.navigate).not.toHaveBeenCalled();
		});

		it("navigates to /active-session when an active session exists", () => {
			mocks.hasActive = true;
			renderHook(() => useHomePage());
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/active-session" });
		});

		it("navigates to /dashboard when no active session exists", () => {
			mocks.hasActive = false;
			renderHook(() => useHomePage());
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
		});

		it("navigates to /dashboard after loading completes with no active session", () => {
			mocks.isLoading = true;
			const { rerender } = renderHook(() => useHomePage());
			expect(mocks.navigate).not.toHaveBeenCalled();

			mocks.isLoading = false;
			mocks.hasActive = false;
			rerender();
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
		});

		it("navigates to /active-session after loading completes with an active session", () => {
			mocks.isLoading = true;
			const { rerender } = renderHook(() => useHomePage());
			expect(mocks.navigate).not.toHaveBeenCalled();

			mocks.isLoading = false;
			mocks.hasActive = true;
			rerender();
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/active-session" });
		});
	});
});
