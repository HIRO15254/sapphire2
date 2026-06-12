import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockRingGame {
	blind1: number | null;
	blind2: number | null;
	id: string;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	name: string | null;
	tableSize: number | null;
}

const mocks = vi.hoisted(() => ({
	session: null as Record<string, unknown> | null,
	ringGames: [] as unknown[],
	isDiscardPending: false,
	discard: vi.fn(),
	lastSessionId: null as string | null,
	sceneState: { scene: "table" },
	lastSceneOptions: null as Record<string, unknown> | null,
}));

vi.mock("@/features/live-sessions/hooks/use-cash-game-session", () => ({
	useCashGameSession: (sessionId: string) => {
		mocks.lastSessionId = sessionId;
		return {
			session: mocks.session,
			ringGames: mocks.ringGames,
			isDiscardPending: mocks.isDiscardPending,
			discard: mocks.discard,
		};
	},
}));

vi.mock("@/features/live-sessions/components/active-session-scene", () => ({
	useActiveSessionSceneState: (options: Record<string, unknown>) => {
		mocks.lastSceneOptions = options;
		return mocks.sceneState;
	},
}));

import { useCashGameSessionView } from "@/features/live-sessions/pages/active-session-page/cash-game-session/use-cash-game-session-view";

function makeSession(
	overrides: Record<string, unknown> = {}
): Record<string, unknown> {
	return {
		id: "cg-1",
		heroSeatPosition: null,
		memo: null,
		ringGameId: null,
		startedAt: new Date("2026-06-01T10:00:00Z"),
		summary: { currentStack: 1500, evDiff: 50, totalBuyIn: 1000 },
		...overrides,
	};
}

function makeRingGame(overrides: Partial<MockRingGame> = {}): MockRingGame {
	return {
		blind1: 100,
		blind2: 200,
		id: "rg-1",
		maxBuyIn: 30_000,
		minBuyIn: 10_000,
		name: "Main game",
		tableSize: 9,
		...overrides,
	};
}

describe("useCashGameSessionView", () => {
	beforeEach(() => {
		mocks.session = null;
		mocks.ringGames = [];
		mocks.isDiscardPending = false;
		mocks.discard.mockReset();
		mocks.lastSessionId = null;
		mocks.lastSceneOptions = null;
	});

	it("forwards sessionId into useCashGameSession", () => {
		renderHook(() => useCashGameSessionView("cg-42"));
		expect(mocks.lastSessionId).toBe("cg-42");
	});

	describe("scene state wiring", () => {
		it("passes a normalized hero seat to the scene state for a valid seat", () => {
			mocks.session = makeSession({ heroSeatPosition: 3 });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.lastSceneOptions).toEqual({
				heroSeatPosition: 3,
				sessionId: "cg-1",
				sessionType: "cash_game",
			});
		});

		it("normalizes seat 0 as a valid hero seat", () => {
			mocks.session = makeSession({ heroSeatPosition: 0 });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.lastSceneOptions?.heroSeatPosition).toBe(0);
		});

		it("normalizes a negative hero seat to null", () => {
			mocks.session = makeSession({ heroSeatPosition: -1 });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.lastSceneOptions?.heroSeatPosition).toBeNull();
		});

		it("normalizes a non-numeric hero seat to null", () => {
			mocks.session = makeSession({ heroSeatPosition: "2" });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.lastSceneOptions?.heroSeatPosition).toBeNull();
		});

		it("returns the scene state from useActiveSessionSceneState", () => {
			mocks.session = makeSession();
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.sceneState).toBe(mocks.sceneState);
		});
	});

	describe("without a session", () => {
		it("returns a null session and null summary", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.session).toBeNull();
			expect(result.current.summary).toBeNull();
		});
	});

	describe("gameInfo", () => {
		it("is empty when the session has no ring game", () => {
			mocks.session = makeSession({ ringGameId: null });
			mocks.ringGames = [makeRingGame()];
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.gameInfo).toEqual({});
			expect(result.current.tableSize).toBeNull();
		});

		it("is empty when the referenced ring game is not in the list", () => {
			mocks.session = makeSession({ ringGameId: "rg-missing" });
			mocks.ringGames = [makeRingGame({ id: "rg-1" })];
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.gameInfo).toEqual({});
		});

		it("formats blinds and buy-in range from the matched ring game", () => {
			mocks.session = makeSession({ ringGameId: "rg-1" });
			mocks.ringGames = [makeRingGame()];
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.gameInfo).toEqual({
				blinds: "100-200",
				buyInRange: "MIN 10k - MAX 30k",
				name: "Main game",
			});
			expect(result.current.tableSize).toBe(9);
		});

		it("leaves blinds null when either blind is missing", () => {
			mocks.session = makeSession({ ringGameId: "rg-1" });
			mocks.ringGames = [makeRingGame({ blind2: null })];
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.gameInfo.blinds).toBeNull();
		});

		it("leaves buyInRange null when either bound is missing", () => {
			mocks.session = makeSession({ ringGameId: "rg-1" });
			mocks.ringGames = [makeRingGame({ minBuyIn: null })];
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.gameInfo.buyInRange).toBeNull();
		});
	});

	describe("summary", () => {
		it("builds the compact summary from the session", () => {
			const startedAt = new Date("2026-06-01T10:00:00Z");
			mocks.session = makeSession({ startedAt });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.summary).toEqual({
				currentStack: 1500,
				evDiff: 50,
				startedAt,
				totalBuyIn: 1000,
			});
		});

		it("coerces a non-numeric evDiff to 0", () => {
			mocks.session = makeSession({
				summary: { currentStack: 1500, evDiff: undefined, totalBuyIn: 1000 },
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.summary?.evDiff).toBe(0);
		});

		it("falls back to now when startedAt is missing", () => {
			mocks.session = makeSession({ startedAt: null });
			const before = Date.now();
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			const startedAt = result.current.summary?.startedAt;
			expect(startedAt).toBeInstanceOf(Date);
			expect((startedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
		});
	});

	describe("discard passthrough", () => {
		it("exposes discard and isDiscardPending unchanged", () => {
			mocks.session = makeSession();
			mocks.isDiscardPending = true;
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.discard).toBe(mocks.discard);
			expect(result.current.isDiscardPending).toBe(true);
		});
	});
});
