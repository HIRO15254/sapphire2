import { IconBolt, IconPlayerPlayFilled } from "@tabler/icons-react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	hasActive: false,
	leftItems: [{ id: "left" }],
	navigate: vi.fn(),
	pathname: "/",
	rightItems: [{ id: "right" }],
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
	useRouterState: (options: { select: (s: unknown) => unknown }) =>
		options.select({ location: { pathname: mocks.pathname } }),
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => ({ hasActive: mocks.hasActive }),
}));

vi.mock("@/shared/components/app-navigation", () => ({
	getMobileNavigationItems: () => ({
		leftItems: mocks.leftItems,
		rightItems: mocks.rightItems,
	}),
}));

import { useMobileNav } from "@/shared/components/authenticated-shell/mobile-nav/use-mobile-nav";

describe("useMobileNav", () => {
	beforeEach(() => {
		mocks.pathname = "/";
		mocks.navigate.mockReset();
		mocks.hasActive = false;
	});

	it("exposes pathname, left/right items and hasActive", () => {
		mocks.pathname = "/statistics";
		const { result } = renderHook(() => useMobileNav());
		expect(result.current.pathname).toBe("/statistics");
		expect(result.current.leftItems).toBe(mocks.leftItems);
		expect(result.current.rightItems).toBe(mocks.rightItems);
		expect(result.current.hasActive).toBe(false);
	});

	it("keeps the normal nav items even while a session is live", () => {
		mocks.hasActive = true;
		const { result } = renderHook(() => useMobileNav());
		expect(result.current.leftItems).toBe(mocks.leftItems);
		expect(result.current.rightItems).toBe(mocks.rightItems);
	});

	describe("centerAction — no active session", () => {
		it("shows 'Start' with accent tone", () => {
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Start");
			expect(result.current.centerAction.tone).toBe("accent");
		});

		it("uses the filled player-play icon for 'Start'", () => {
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.icon).toBe(IconPlayerPlayFilled);
		});

		it("'Start' onClick opens the create dialog", () => {
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.isCreateOpen).toBe(false);
			act(() => result.current.centerAction.onClick());
			expect(result.current.isCreateOpen).toBe(true);
		});

		it("'Start' onClick does not navigate", () => {
			const { result } = renderHook(() => useMobileNav());
			act(() => result.current.centerAction.onClick());
			expect(mocks.navigate).not.toHaveBeenCalled();
		});

		it("onCreateOpenChange closes the create dialog", () => {
			const { result } = renderHook(() => useMobileNav());
			act(() => result.current.centerAction.onClick());
			act(() => result.current.onCreateOpenChange(false));
			expect(result.current.isCreateOpen).toBe(false);
		});

		it("shows 'Start' even on the active-session path when no session exists", () => {
			mocks.pathname = "/active-session";
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Start");
		});
	});

	describe("centerAction — active session", () => {
		beforeEach(() => {
			mocks.hasActive = true;
			mocks.pathname = "/sessions";
		});

		it("shows 'Live' with live tone", () => {
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Live");
			expect(result.current.centerAction.tone).toBe("live");
		});

		it("uses the bolt icon for 'Live'", () => {
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.icon).toBe(IconBolt);
		});

		it("'Live' onClick navigates to the active session exactly once", () => {
			const { result } = renderHook(() => useMobileNav());
			act(() => result.current.centerAction.onClick());
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenNthCalledWith(1, {
				to: "/active-session",
			});
		});

		it("'Live' onClick does not open the create dialog", () => {
			const { result } = renderHook(() => useMobileNav());
			act(() => result.current.centerAction.onClick());
			expect(result.current.isCreateOpen).toBe(false);
		});

		it("stays 'Live' on the active-session page itself", () => {
			mocks.pathname = "/active-session";
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Live");
		});

		it("stays 'Live' on an active-session sub-path", () => {
			mocks.pathname = "/active-session/anything";
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Live");
		});

		it("stays 'Live' on a similarly-prefixed path", () => {
			mocks.pathname = "/active-sessions";
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Live");
		});
	});
});
