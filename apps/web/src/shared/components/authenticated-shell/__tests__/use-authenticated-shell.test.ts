import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	useMediaQuery: vi.fn(),
	useActiveSession: vi.fn(),
	pathname: "/",
}));

vi.mock("@/shared/hooks/use-media-query", () => ({
	useMediaQuery: mocks.useMediaQuery,
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: mocks.useActiveSession,
}));

vi.mock("@tanstack/react-router", () => ({
	useRouterState: (options: { select: (s: unknown) => unknown }) =>
		options.select({ location: { pathname: mocks.pathname } }),
}));

import {
	isImmersivePath,
	useAuthenticatedShell,
} from "@/shared/components/authenticated-shell/use-authenticated-shell";

describe("isImmersivePath", () => {
	it("is true for the active-session root path", () => {
		expect(isImmersivePath("/active-session")).toBe(true);
	});

	it("is true for active-session subpaths", () => {
		expect(isImmersivePath("/active-session/anything")).toBe(true);
	});

	it("is false for the sessions list path", () => {
		expect(isImmersivePath("/sessions")).toBe(false);
	});

	it("is false for the root path", () => {
		expect(isImmersivePath("/")).toBe(false);
	});

	it("is false for a path that merely shares the active-session prefix", () => {
		expect(isImmersivePath("/active-sessions")).toBe(false);
	});
});

describe("useAuthenticatedShell", () => {
	beforeEach(() => {
		mocks.useMediaQuery.mockReset();
		mocks.useActiveSession.mockReset();
		mocks.useActiveSession.mockReturnValue({
			activeSession: null,
			hasActive: false,
			isLoading: false,
		});
		mocks.pathname = "/";
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
		expect(result.current.isDesktop).toBe(true);
	});

	it("returns isDesktop=false when the media query does not match", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		const { result } = renderHook(() => useAuthenticatedShell());
		expect(result.current.isDesktop).toBe(false);
	});

	it("exposes the active session id so the form provider can key its state", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		mocks.useActiveSession.mockReturnValue({
			activeSession: { id: "session-42", type: "tournament", status: "active" },
			hasActive: true,
			isLoading: false,
		});
		const { result } = renderHook(() => useAuthenticatedShell());
		expect(result.current.activeSessionId).toBe("session-42");
	});

	it("exposes a null active session id when no session is live", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		mocks.useActiveSession.mockReturnValue({
			activeSession: null,
			hasActive: false,
			isLoading: false,
		});
		const { result } = renderHook(() => useAuthenticatedShell());
		expect(result.current.activeSessionId).toBeNull();
	});

	it("returns isImmersive=true when on the active-session route", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		mocks.pathname = "/active-session";
		const { result } = renderHook(() => useAuthenticatedShell());
		expect(result.current.isImmersive).toBe(true);
	});

	it("returns isImmersive=true when on an active-session subpath", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		mocks.pathname = "/active-session/tournament";
		const { result } = renderHook(() => useAuthenticatedShell());
		expect(result.current.isImmersive).toBe(true);
	});

	it("returns isImmersive=false when off the active-session route", () => {
		mocks.useMediaQuery.mockReturnValue(false);
		mocks.pathname = "/sessions";
		const { result } = renderHook(() => useAuthenticatedShell());
		expect(result.current.isImmersive).toBe(false);
	});
});
