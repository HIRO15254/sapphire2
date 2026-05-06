import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	isAuthPending: false,
	session: null as null | { user: { email: string; name: string } },
	cashItems: [] as Array<{ id: string }>,
	cashIsLoading: false,
	tournamentItems: [] as Array<{ id: string }>,
	tournamentIsLoading: false,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({ data: mocks.session, isPending: mocks.isAuthPending }),
	},
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: (options: { queryKey?: unknown[]; enabled?: boolean }) => {
		const key = options.queryKey?.[0];
		if (key === "liveCashGameSession.list") {
			return {
				data: { items: mocks.cashItems },
				isLoading: mocks.cashIsLoading,
			};
		}
		if (key === "liveTournamentSession.list") {
			return {
				data: { items: mocks.tournamentItems },
				isLoading: mocks.tournamentIsLoading,
			};
		}
		return { data: undefined, isLoading: false };
	},
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: ["liveCashGameSession.list", input],
				}),
			},
		},
		liveTournamentSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: ["liveTournamentSession.list", input],
				}),
			},
		},
	},
}));

import { useHomePage } from "@/routes/-use-home-page";

describe("useHomePage", () => {
	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.isAuthPending = false;
		mocks.session = null;
		mocks.cashItems = [];
		mocks.cashIsLoading = false;
		mocks.tournamentItems = [];
		mocks.tournamentIsLoading = false;
	});

	describe("isLoading", () => {
		it("is true when auth is pending", () => {
			mocks.isAuthPending = true;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isLoading).toBe(true);
		});

		it("is true when signed in and cash session query is loading", () => {
			mocks.session = { user: { email: "a@b.c", name: "Alice" } };
			mocks.cashIsLoading = true;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isLoading).toBe(true);
		});

		it("is true when signed in and tournament session query is loading", () => {
			mocks.session = { user: { email: "a@b.c", name: "Alice" } };
			mocks.tournamentIsLoading = true;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isLoading).toBe(true);
		});

		it("is false when not signed in and not pending", () => {
			mocks.session = null;
			mocks.isAuthPending = false;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isLoading).toBe(false);
		});

		it("is false when signed in and session queries are done", () => {
			mocks.session = { user: { email: "a@b.c", name: "Alice" } };
			mocks.cashIsLoading = false;
			mocks.tournamentIsLoading = false;
			const { result } = renderHook(() => useHomePage());
			expect(result.current.isLoading).toBe(false);
		});
	});

	describe("redirect behaviour", () => {
		it("redirects to /login when not signed in and not loading", () => {
			mocks.session = null;
			renderHook(() => useHomePage());
			expect(mocks.navigate).toHaveBeenCalledOnce();
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login" });
		});

		it("redirects to /active-session when signed in and a cash session is active", () => {
			mocks.session = { user: { email: "a@b.c", name: "Alice" } };
			mocks.cashItems = [{ id: "cash-1" }];
			renderHook(() => useHomePage());
			expect(mocks.navigate).toHaveBeenCalledOnce();
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/active-session" });
		});

		it("redirects to /active-session when signed in and a tournament session is active", () => {
			mocks.session = { user: { email: "a@b.c", name: "Alice" } };
			mocks.tournamentItems = [{ id: "tour-1" }];
			renderHook(() => useHomePage());
			expect(mocks.navigate).toHaveBeenCalledOnce();
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/active-session" });
		});

		it("redirects to /dashboard when signed in and no active session", () => {
			mocks.session = { user: { email: "a@b.c", name: "Alice" } };
			mocks.cashItems = [];
			mocks.tournamentItems = [];
			renderHook(() => useHomePage());
			expect(mocks.navigate).toHaveBeenCalledOnce();
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
		});

		it("does not navigate while auth is pending", () => {
			mocks.isAuthPending = true;
			mocks.session = null;
			renderHook(() => useHomePage());
			expect(mocks.navigate).not.toHaveBeenCalled();
		});

		it("does not navigate while session queries are loading", () => {
			mocks.session = { user: { email: "a@b.c", name: "Alice" } };
			mocks.cashIsLoading = true;
			renderHook(() => useHomePage());
			expect(mocks.navigate).not.toHaveBeenCalled();
		});
	});
});
