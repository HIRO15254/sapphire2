import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	sessionData: null as Record<string, unknown> | null,
	isLoading: false,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();
	return {
		...actual,
		useQuery: vi.fn(() => ({
			data: mocks.sessionData,
			isLoading: mocks.isLoading,
		})),
	};
});

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			getById: {
				queryOptions: vi.fn((input) => ({
					queryKey: ["session", "getById", input],
					queryFn: vi.fn(),
				})),
			},
		},
	},
}));

import { useSessionDetailPage } from "@/routes/sessions/-use-session-detail-page";

describe("useSessionDetailPage", () => {
	describe("initial / loading state", () => {
		it("returns null session and isLoading true while loading", () => {
			mocks.sessionData = null;
			mocks.isLoading = true;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isLoading).toBe(true);
			expect(result.current.session).toBeNull();
		});

		it("returns undefined session and isLoading false when not found", () => {
			mocks.sessionData = null;
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isLoading).toBe(false);
			expect(result.current.session).toBeNull();
		});
	});

	describe("session type derivation", () => {
		it("returns sessionType cash_game for a cash_game session", () => {
			mocks.sessionData = {
				id: "s1",
				kind: "cash_game",
				source: "manual",
				status: "completed",
			};
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.sessionType).toBe("cash_game");
		});

		it("returns sessionType tournament for a tournament session", () => {
			mocks.sessionData = {
				id: "s1",
				kind: "tournament",
				source: "live",
				status: "active",
			};
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.sessionType).toBe("tournament");
		});

		it("defaults to cash_game when kind is undefined", () => {
			mocks.sessionData = {
				id: "s1",
				kind: undefined,
				source: "manual",
				status: "completed",
			};
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.sessionType).toBe("cash_game");
		});
	});

	describe("isLive flag", () => {
		it("isLive is true for a live session", () => {
			mocks.sessionData = {
				id: "s1",
				kind: "cash_game",
				source: "live",
				status: "active",
			};
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isLive).toBe(true);
		});

		it("isLive is false for a manual session", () => {
			mocks.sessionData = {
				id: "s1",
				kind: "cash_game",
				source: "manual",
				status: "completed",
			};
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isLive).toBe(false);
		});

		it("isLive is false when session is null", () => {
			mocks.sessionData = null;
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isLive).toBe(false);
		});
	});

	describe("isDiscarded flag", () => {
		it("isDiscarded is true for a discarded session", () => {
			mocks.sessionData = {
				id: "s1",
				kind: "cash_game",
				source: "live",
				status: "discarded",
			};
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isDiscarded).toBe(true);
		});

		it("isDiscarded is false for a completed session", () => {
			mocks.sessionData = {
				id: "s1",
				kind: "tournament",
				source: "live",
				status: "completed",
			};
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isDiscarded).toBe(false);
		});

		it("isDiscarded is false for an active session", () => {
			mocks.sessionData = {
				id: "s1",
				kind: "cash_game",
				source: "live",
				status: "active",
			};
			mocks.isLoading = false;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isDiscarded).toBe(false);
		});
	});
});
