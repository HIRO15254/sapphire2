import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();

const mocks = vi.hoisted(() => ({
	activeSession: null as null | { id: string; status: string; type: string },
	isLoading: false,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => ({
		activeSession: mocks.activeSession,
		hasActive: mocks.activeSession !== null,
		isLoading: mocks.isLoading,
	}),
}));

import { useHomePage } from "@/routes/-use-home-page";

describe("useHomePage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.activeSession = null;
		mocks.isLoading = false;
	});

	it("redirects to /active-session when an active session exists", () => {
		mocks.activeSession = { id: "s1", status: "active", type: "cash_game" };
		renderHook(() => useHomePage());
		expect(navigate).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith({ to: "/active-session" });
	});

	it("redirects to /dashboard when signed in but no active session", () => {
		mocks.activeSession = null;
		renderHook(() => useHomePage());
		expect(navigate).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
	});

	it("does not redirect while loading", () => {
		mocks.isLoading = true;
		mocks.activeSession = null;
		renderHook(() => useHomePage());
		expect(navigate).not.toHaveBeenCalled();
	});

	it("redirects once when loading completes", () => {
		mocks.isLoading = true;
		mocks.activeSession = null;
		const { rerender } = renderHook(() => useHomePage());
		expect(navigate).not.toHaveBeenCalled();

		mocks.isLoading = false;
		act(() => {
			rerender();
		});
		expect(navigate).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
	});

	it("does not redirect a second time on re-render after first navigation", () => {
		mocks.activeSession = null;
		const { rerender } = renderHook(() => useHomePage());
		expect(navigate).toHaveBeenCalledOnce();

		act(() => {
			rerender();
		});
		expect(navigate).toHaveBeenCalledOnce();
	});

	it("redirects to /active-session when session becomes active after loading", () => {
		mocks.isLoading = true;
		mocks.activeSession = null;
		const { rerender } = renderHook(() => useHomePage());
		expect(navigate).not.toHaveBeenCalled();

		mocks.isLoading = false;
		mocks.activeSession = { id: "s2", status: "active", type: "tournament" };
		act(() => {
			rerender();
		});
		expect(navigate).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith({ to: "/active-session" });
	});
});
