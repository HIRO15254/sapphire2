import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	session: null as Record<string, unknown> | null,
	ringGames: [] as unknown[],
	isDiscardPending: false,
	discard: vi.fn(),
	lastSessionId: null as string | null,
	sceneState: { scene: "list" },
	lastSceneOptions: null as Record<string, unknown> | null,
	stack: {
		recordStack: vi.fn(),
		addChip: vi.fn(),
		removeChip: vi.fn(),
		addAllIn: vi.fn(),
		addMemo: vi.fn(),
		addVirtualBuyIn: vi.fn(),
		addVirtualCashOut: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(),
		complete: vi.fn(),
		isStackPending: false,
		isCompletePending: false,
	},
	lastStackOptions: null as Record<string, unknown> | null,
	items: [] as unknown[],
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

vi.mock("@/features/live-sessions/hooks/use-cash-game-stack", () => ({
	useCashGameStack: (options: Record<string, unknown>) => {
		mocks.lastStackOptions = options;
		return mocks.stack;
	},
}));

vi.mock("@/features/live-sessions/components/active-session-scene", () => ({
	useActiveSessionSceneState: (options: Record<string, unknown>) => {
		mocks.lastSceneOptions = options;
		return mocks.sceneState;
	},
}));

vi.mock("@/features/items/hooks/use-items", () => ({
	useItems: () => ({ items: mocks.items }),
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
		summary: {
			chipRemoveTotal: 0,
			currentStack: 1500,
			evDiff: 50,
			totalBuyIn: 1000,
		},
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
		mocks.lastStackOptions = null;
		for (const fn of Object.values(mocks.stack)) {
			if (typeof fn === "function") {
				(fn as ReturnType<typeof vi.fn>).mockReset();
			}
		}
		mocks.stack.isCompletePending = false;
	});

	it("forwards sessionId into useCashGameSession and useCashGameStack", () => {
		renderHook(() => useCashGameSessionView("cg-42"));
		expect(mocks.lastSessionId).toBe("cg-42");
		expect(mocks.lastStackOptions).toEqual({ sessionId: "cg-42" });
	});

	describe("scene state wiring", () => {
		it("passes a normalized hero seat to the scene state for a valid seat", () => {
			mocks.session = makeSession({ heroSeatPosition: 3, tableSize: 6 });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.lastSceneOptions).toEqual({
				heroSeatPosition: 3,
				sessionId: "cg-1",
				sessionType: "cash_game",
				tableSize: 6,
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

	describe("summary", () => {
		it("builds the compact summary from the session", () => {
			const startedAt = new Date("2026-06-01T10:00:00Z");
			mocks.session = makeSession({ startedAt });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.summary).toEqual({
				chipRemoveTotal: 0,
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

		it("threads chipRemoveTotal from the session summary (SA2-124)", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 300,
					currentStack: 400,
					evDiff: 0,
					totalBuyIn: 500,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.summary?.chipRemoveTotal).toBe(300);
		});

		it("coerces a non-numeric chipRemoveTotal to 0", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: undefined,
					currentStack: 1500,
					evDiff: 0,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.summary?.chipRemoveTotal).toBe(0);
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

	describe("event menu extra items", () => {
		it("lists All-in / Add chips / Remove chips / Virtual buy-in / Virtual cash-out / Memo in that order", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.eventMenuExtraItems.map((i) => i.label)).toEqual([
				"All-in",
				"Add chips",
				"Remove chips",
				"Virtual buy-in",
				"Virtual cash-out",
				"Memo",
			]);
		});

		it("'All-in' opens the all-in sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.isAllInOpen).toBe(false);
			act(() => result.current.eventMenuExtraItems[0]?.onSelect());
			expect(result.current.isAllInOpen).toBe(true);
		});

		it("'Add chips' opens the add-chips sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.eventMenuExtraItems[1]?.onSelect());
			expect(result.current.isAddChipsOpen).toBe(true);
		});

		it("'Remove chips' opens the remove-chips sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.eventMenuExtraItems[2]?.onSelect());
			expect(result.current.isRemoveChipsOpen).toBe(true);
		});

		it("'Memo' opens the memo sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.eventMenuExtraItems[5]?.onSelect());
			expect(result.current.isMemoOpen).toBe(true);
		});
	});

	describe("event submissions", () => {
		it("handleAllInSubmit records the all-in and closes the sheet", () => {
			const values = { potSize: 900, trials: 1, equity: 50, wins: 1 };
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.eventMenuExtraItems[0]?.onSelect());
			act(() => result.current.handleAllInSubmit(values));
			expect(mocks.stack.addAllIn).toHaveBeenCalledTimes(1);
			expect(mocks.stack.addAllIn).toHaveBeenCalledWith(values);
			expect(result.current.isAllInOpen).toBe(false);
		});

		it("handleAddChipsSubmit records the addon amount and closes the sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.eventMenuExtraItems[1]?.onSelect());
			act(() => result.current.handleAddChipsSubmit({ amount: 300 }));
			expect(mocks.stack.addChip).toHaveBeenCalledTimes(1);
			expect(mocks.stack.addChip).toHaveBeenCalledWith(300);
			expect(result.current.isAddChipsOpen).toBe(false);
		});

		it("handleRemoveChipsSubmit records the removal and closes the sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.eventMenuExtraItems[2]?.onSelect());
			act(() => result.current.handleRemoveChipsSubmit({ amount: 200 }));
			expect(mocks.stack.removeChip).toHaveBeenCalledTimes(1);
			expect(mocks.stack.removeChip).toHaveBeenCalledWith(200);
			expect(result.current.isRemoveChipsOpen).toBe(false);
		});

		it("handleMemoSubmit records the memo and closes the sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.eventMenuExtraItems[5]?.onSelect());
			act(() => result.current.handleMemoSubmit("note"));
			expect(mocks.stack.addMemo).toHaveBeenCalledTimes(1);
			expect(mocks.stack.addMemo).toHaveBeenCalledWith("note");
			expect(result.current.isMemoOpen).toBe(false);
		});
	});

	describe("session lifecycle", () => {
		it("onPause pauses the session", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onPause());
			expect(mocks.stack.pause).toHaveBeenCalledTimes(1);
		});

		it("onEndSession opens the complete sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.isCompleteOpen).toBe(false);
			act(() => result.current.onEndSession());
			expect(result.current.isCompleteOpen).toBe(true);
		});

		it("handleCompleteSubmit completes the session and closes the sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onEndSession());
			act(() => result.current.handleCompleteSubmit({ finalStack: 2500 }));
			expect(mocks.stack.complete).toHaveBeenCalledTimes(1);
			expect(mocks.stack.complete).toHaveBeenCalledWith({ finalStack: 2500 });
			expect(result.current.isCompleteOpen).toBe(false);
		});

		it("defaults the final stack to the current stack", () => {
			mocks.session = makeSession();
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.defaultFinalStack).toBe(1500);
		});

		it("leaves the final stack undefined when the current stack is null", () => {
			mocks.session = makeSession({
				summary: { currentStack: null, evDiff: 0, totalBuyIn: 1000 },
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.defaultFinalStack).toBeUndefined();
		});

		it("exposes isCompletePending from the stack hook", () => {
			mocks.stack.isCompletePending = true;
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.isCompletePending).toBe(true);
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

describe("virtual buy-in / cash-out", () => {
	const purePayload = {
		amount: 500,
		itemId: null,
		itemName: null,
		count: null,
		unitValue: null,
		currencyId: null,
	};

	it("offers Virtual buy-in and Virtual cash-out in the event menu", () => {
		mocks.session = makeSession();
		const { result } = renderHook(() => useCashGameSessionView("cg-1"));
		const labels = result.current.eventMenuExtraItems.map((item) => item.label);
		expect(labels).toContain("Virtual buy-in");
		expect(labels).toContain("Virtual cash-out");
	});

	it("opens the buy-in sheet from the menu and submits through the stack", () => {
		mocks.session = makeSession();
		const { result } = renderHook(() => useCashGameSessionView("cg-1"));
		act(() => {
			result.current.eventMenuExtraItems
				.find((item) => item.label === "Virtual buy-in")
				?.onSelect();
		});
		expect(result.current.isVirtualBuyInOpen).toBe(true);

		act(() => {
			result.current.handleVirtualBuyInSubmit(purePayload);
		});
		expect(mocks.stack.addVirtualBuyIn).toHaveBeenCalledTimes(1);
		expect(mocks.stack.addVirtualBuyIn).toHaveBeenNthCalledWith(1, purePayload);
		expect(result.current.isVirtualBuyInOpen).toBe(false);
	});

	it("opens the cash-out sheet from the menu and submits through the stack", () => {
		mocks.session = makeSession();
		const { result } = renderHook(() => useCashGameSessionView("cg-1"));
		act(() => {
			result.current.eventMenuExtraItems
				.find((item) => item.label === "Virtual cash-out")
				?.onSelect();
		});
		expect(result.current.isVirtualCashOutOpen).toBe(true);

		act(() => {
			result.current.handleVirtualCashOutSubmit(purePayload);
		});
		expect(mocks.stack.addVirtualCashOut).toHaveBeenCalledTimes(1);
		expect(mocks.stack.addVirtualCashOut).toHaveBeenNthCalledWith(
			1,
			purePayload
		);
		expect(result.current.isVirtualCashOutOpen).toBe(false);
	});

	it("filters item options to the session currency (fail closed without one)", () => {
		mocks.items = [
			{ id: "i1", name: "Ticket", unitValue: 1000, currencyId: "c1" },
			{ id: "i2", name: "Voucher", unitValue: 500, currencyId: "c2" },
		];
		mocks.session = makeSession({ currencyId: "c1" });
		const { result } = renderHook(() => useCashGameSessionView("cg-1"));
		expect(result.current.virtualItems).toEqual([
			{ id: "i1", name: "Ticket", unitValue: 1000, currencyId: "c1" },
		]);

		mocks.session = makeSession({ currencyId: null });
		const { result: noCurrency } = renderHook(() =>
			useCashGameSessionView("cg-1")
		);
		expect(noCurrency.current.virtualItems).toEqual([]);
	});
});
