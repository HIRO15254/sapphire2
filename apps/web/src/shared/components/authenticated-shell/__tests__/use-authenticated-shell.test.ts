import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	useMediaQuery: vi.fn(),
	useActiveSession: vi.fn(),
}));

vi.mock("@/shared/hooks/use-media-query", () => ({
	useMediaQuery: mocks.useMediaQuery,
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: mocks.useActiveSession,
}));

import { useAuthenticatedShell } from "@/shared/components/authenticated-shell/use-authenticated-shell";

describe("useAuthenticatedShell", () => {
	beforeEach(() => {
		mocks.useMediaQuery.mockReset();
		mocks.useActiveSession.mockReset();
		mocks.useActiveSession.mockReturnValue({
			activeSession: null,
			hasActive: false,
			isLoading: false,
		});
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
});
