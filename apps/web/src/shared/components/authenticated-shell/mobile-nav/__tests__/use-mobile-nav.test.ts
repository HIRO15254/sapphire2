import { IconPlayerPlayFilled } from "@tabler/icons-react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ActiveSession = {
	id: string;
	status: "active" | "paused";
	type: "cash_game" | "tournament";
} | null;

const mocks = vi.hoisted(() => ({
	pathname: "/",
	navigate: vi.fn(),
	activeSession: null as ActiveSession,
	hasActive: false,
	stackOpen: vi.fn(),
	mutate: vi.fn(),
	sessionEventCreateMutate: vi.fn(),
	leftItems: [{ id: "left" }],
	rightItems: [{ id: "right" }],
	mutationOptions: {},
}));

vi.mock("@tanstack/react-router", () => ({
	useRouterState: (options: { select: (s: unknown) => unknown }) =>
		options.select({ location: { pathname: mocks.pathname } }),
	useNavigate: () => mocks.navigate,
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
		setQueryData: vi.fn(),
		invalidateQueries: vi.fn(),
	}),
	useMutation: (options: { mutationFn: () => Promise<unknown> }) => ({
		mutate: () => {
			mocks.mutate();
			return options.mutationFn();
		},
		isPending: false,
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => ({
		activeSession: mocks.activeSession,
		hasActive: mocks.hasActive,
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-stack-sheet", () => ({
	useStackSheet: () => ({ open: mocks.stackOpen }),
}));

vi.mock("@/features/live-sessions/utils/optimistic-session-event", () => ({
	createSessionEventMutationOptions: vi.fn(() => mocks.mutationOptions),
}));

vi.mock("@/shared/components/app-navigation", () => ({
	getMobileNavigationItems: () => ({
		leftItems: mocks.leftItems,
		rightItems: mocks.rightItems,
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpcClient: {
		sessionEvent: {
			create: { mutate: mocks.sessionEventCreateMutate },
		},
	},
}));

import { useMobileNav } from "@/shared/components/authenticated-shell/mobile-nav/use-mobile-nav";

describe("useMobileNav", () => {
	beforeEach(() => {
		mocks.pathname = "/";
		mocks.navigate.mockReset();
		mocks.activeSession = null;
		mocks.hasActive = false;
		mocks.stackOpen.mockReset();
		mocks.mutate.mockReset();
		mocks.sessionEventCreateMutate.mockReset();
	});

	it("exposes pathname, left/right items, activeSession, hasActive", () => {
		mocks.pathname = "/statistics";
		const { result } = renderHook(() => useMobileNav());
		expect(result.current.pathname).toBe("/statistics");
		expect(result.current.leftItems).toBe(mocks.leftItems);
		expect(result.current.rightItems).toBe(mocks.rightItems);
		expect(result.current.activeSession).toBeNull();
		expect(result.current.hasActive).toBe(false);
	});

	it("keeps the normal nav items even while a session is live", () => {
		mocks.hasActive = true;
		mocks.activeSession = { id: "cg-1", status: "active", type: "cash_game" };
		const { result } = renderHook(() => useMobileNav());
		expect(result.current.leftItems).toBe(mocks.leftItems);
		expect(result.current.rightItems).toBe(mocks.rightItems);
	});

	describe("centerAction — no active session", () => {
		it("shows 'Start' with accent tone when no session", () => {
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

	describe("centerAction — active session, off the active-session page", () => {
		beforeEach(() => {
			mocks.hasActive = true;
			mocks.activeSession = {
				id: "cg-1",
				status: "active",
				type: "cash_game",
			};
			mocks.pathname = "/sessions";
		});

		it("shows 'Live' with live tone", () => {
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Live");
			expect(result.current.centerAction.tone).toBe("live");
		});

		it("'Live' onClick navigates to /active-session", () => {
			const { result } = renderHook(() => useMobileNav());
			act(() => result.current.centerAction.onClick());
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/active-session" });
		});

		it("'Live' onClick does not open the stack sheet", () => {
			const { result } = renderHook(() => useMobileNav());
			act(() => result.current.centerAction.onClick());
			expect(mocks.stackOpen).not.toHaveBeenCalled();
		});

		it("a similarly-prefixed path (/active-sessions) still counts as off-page", () => {
			mocks.pathname = "/active-sessions";
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Live");
		});
	});

	describe("centerAction — active session, on the active-session page", () => {
		beforeEach(() => {
			mocks.hasActive = true;
			mocks.activeSession = {
				id: "cg-1",
				status: "active",
				type: "cash_game",
			};
			mocks.pathname = "/active-session";
		});

		it("shows 'Stack' with live tone", () => {
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Stack");
			expect(result.current.centerAction.tone).toBe("live");
		});

		it("'Stack' onClick opens the stack sheet exactly once", () => {
			const { result } = renderHook(() => useMobileNav());
			act(() => result.current.centerAction.onClick());
			expect(mocks.stackOpen).toHaveBeenCalledTimes(1);
		});

		it("'Stack' onClick does not navigate", () => {
			const { result } = renderHook(() => useMobileNav());
			act(() => result.current.centerAction.onClick());
			expect(mocks.navigate).not.toHaveBeenCalled();
		});

		it("treats /active-session sub-paths as on-page", () => {
			mocks.pathname = "/active-session/anything";
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Stack");
		});
	});

	describe("centerAction — active session (paused)", () => {
		beforeEach(() => {
			mocks.hasActive = true;
			mocks.activeSession = {
				id: "cg-1",
				status: "paused",
				type: "cash_game",
			};
			mocks.sessionEventCreateMutate.mockResolvedValue(undefined);
		});

		it("shows 'Resume' with live tone", () => {
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Resume");
			expect(result.current.centerAction.tone).toBe("live");
		});

		it("shows 'Resume' even while on the active-session page", () => {
			mocks.pathname = "/active-session";
			const { result } = renderHook(() => useMobileNav());
			expect(result.current.centerAction.label).toBe("Resume");
		});

		it("'Resume' onClick triggers the mutation and navigates", () => {
			const { result } = renderHook(() => useMobileNav());
			act(() => result.current.centerAction.onClick());
			expect(mocks.mutate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/active-session" });
		});

		it("mutationFn hits sessionEvent.create with liveCashGameSessionId for cash_game", async () => {
			const { result } = renderHook(() => useMobileNav());
			await act(async () => {
				await result.current.centerAction.onClick();
			});
			expect(mocks.sessionEventCreateMutate).toHaveBeenCalledWith({
				liveCashGameSessionId: "cg-1",
				eventType: "session_resume",
				payload: {},
			});
		});

		it("mutationFn hits sessionEvent.create with liveTournamentSessionId for tournament", async () => {
			mocks.activeSession = {
				id: "tn-1",
				status: "paused",
				type: "tournament",
			};
			const { result } = renderHook(() => useMobileNav());
			await act(async () => {
				await result.current.centerAction.onClick();
			});
			expect(mocks.sessionEventCreateMutate).toHaveBeenCalledWith({
				liveTournamentSessionId: "tn-1",
				eventType: "session_resume",
				payload: {},
			});
		});
	});
});
