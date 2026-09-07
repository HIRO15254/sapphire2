import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import { withHeroSeat } from "@/features/live-sessions/pages/live-session-page/seat-fields";
import type {
	ChipPurchaseOption,
	EventEditorSubmit,
	EventEditorTarget,
} from "@/features/live-sessions/pages/live-session-page/sheets/event-editor-sheet/use-event-editor-sheet";
import { useEventEditorSheet } from "@/features/live-sessions/pages/live-session-page/sheets/event-editor-sheet/use-event-editor-sheet";
import type { EventEditorKind } from "@/features/live-sessions/utils/timeline-view";

const OCCURRED_AT = new Date(2026, 5, 1, 22, 41);

const PURCHASE_OPTIONS: ChipPurchaseOption[] = [
	{ chips: 30_000, cost: 10_000, id: "p-re", name: "Re-entry" },
	{ chips: 20_000, cost: 5000, id: "p-add", name: "Add-on" },
];

function editTarget(
	kind: EventEditorKind,
	event: Partial<SessionEvent> & { payload: unknown }
): EventEditorTarget {
	return {
		event: {
			eventType: "x",
			id: "evt-1",
			occurredAt: OCCURRED_AT,
			...event,
		},
		kind,
		label: "Existing",
		mode: "edit",
		openedAt: OCCURRED_AT,
	};
}

const SEATABLE_PLAYERS = [
	{ id: "player-1", name: "Young guy", seatPosition: 2 },
	{ id: "player-2", name: "Red cap", seatPosition: null },
];

function setup(
	target: EventEditorTarget,
	isTournament = false,
	occupiedSeatPositions: ReadonlySet<number> = new Set()
) {
	const onSubmit = vi.fn<(values: EventEditorSubmit) => void>();
	const view = renderHook(() =>
		useEventEditorSheet({
			chipPurchaseOptions: PURCHASE_OPTIONS,
			isTournament,
			maxTime: null,
			minTime: null,
			occupiedSeatPositions,
			onSubmit,
			seatCount: 9,
			seatablePlayers: SEATABLE_PLAYERS,
			target,
		})
	);
	return { onSubmit, ...view };
}

async function submit(form: { handleSubmit: () => Promise<void> }) {
	await act(async () => {
		await form.handleSubmit();
	});
}

describe("chip adjust editing", () => {
	it("loads a withdrawal as a positive amount with the remove direction", () => {
		const { result } = setup(
			editTarget("chips", { payload: { amount: -10_000 } })
		);

		expect(result.current.form.state.values.amount).toBe("10000");
		expect(result.current.form.state.values.direction).toBe("remove");
	});

	it("signs the amount by the chosen direction", async () => {
		const { onSubmit, result } = setup(
			editTarget("chips", { payload: { amount: 20_000 } })
		);

		await submit(result.current.form);
		expect(onSubmit.mock.calls[0]?.[0].payload).toEqual({ amount: 20_000 });

		act(() => {
			result.current.form.setFieldValue("direction", "remove");
		});
		await submit(result.current.form);
		expect(onSubmit.mock.calls[1]?.[0].payload).toEqual({ amount: -20_000 });
	});

	it("rejects a zero amount, which the server refuses to store", async () => {
		const { onSubmit, result } = setup(
			editTarget("chips", { payload: { amount: 20_000 } })
		);

		act(() => {
			result.current.form.setFieldValue("amount", "0");
		});
		await submit(result.current.form);

		expect(onSubmit).not.toHaveBeenCalled();
	});
});

describe("stack editing", () => {
	it("keeps recorded chip purchases and clears blank player counts", async () => {
		const chipPurchaseCounts = [
			{ chipsPerUnit: 30_000, count: 2, name: "Re-entry" },
		];
		const { onSubmit, result } = setup(
			editTarget("stack", {
				payload: {
					chipPurchaseCounts,
					remainingPlayers: 42,
					stackAmount: 48_300,
					totalEntries: 128,
				},
			}),
			true
		);

		act(() => {
			result.current.form.setFieldValue("remainingPlayers", "");
		});
		await submit(result.current.form);

		expect(onSubmit.mock.calls[0]?.[0].payload).toEqual({
			chipPurchaseCounts,
			remainingPlayers: null,
			stackAmount: 48_300,
			totalEntries: 128,
		});
	});

	it("omits the tournament-only fields for a cash session", async () => {
		const { onSubmit, result } = setup(
			editTarget("stack", { payload: { stackAmount: 51_800 } })
		);

		await submit(result.current.form);

		expect(onSubmit.mock.calls[0]?.[0].payload).toEqual({
			stackAmount: 51_800,
		});
	});
});

describe("all-in editing", () => {
	it("refuses more wins than runs, which would corrupt the EV total", async () => {
		const { onSubmit, result } = setup(
			editTarget("allin", {
				payload: { equity: 78, potSize: 12_400, trials: 1, wins: 1 },
			})
		);

		act(() => {
			result.current.form.setFieldValue("wins", "2");
		});
		await submit(result.current.form);

		expect(onSubmit).not.toHaveBeenCalled();
	});
});

describe("logging a new event", () => {
	it("times a new note by the entered clock time on the day it was opened", async () => {
		const target: EventEditorTarget = {
			event: null,
			kind: "memo",
			label: "Note",
			mode: "create",
			openedAt: new Date(2026, 5, 1, 23, 10),
		};
		const { onSubmit, result } = setup(target);

		act(() => {
			result.current.form.setFieldValue("memoText", "  S2 started drinking.  ");
			result.current.form.setFieldValue("time", "23:05");
		});
		await submit(result.current.form);

		const submitted = onSubmit.mock.calls[0]?.[0];
		expect(submitted?.payload).toEqual({ text: "S2 started drinking." });
		expect(submitted?.occurredAt).toBe(
			Math.floor(new Date(2026, 5, 1, 23, 5).getTime() / 1000)
		);
	});

	it("snapshots the selected purchase option into the payload", async () => {
		const target: EventEditorTarget = {
			event: null,
			kind: "purchase",
			label: "Chip purchase",
			mode: "create",
			openedAt: OCCURRED_AT,
		};
		const { onSubmit, result } = setup(target, true);

		act(() => {
			result.current.form.setFieldValue("purchaseId", "p-add");
		});
		await submit(result.current.form);

		expect(onSubmit.mock.calls[0]?.[0].payload).toEqual({
			chips: 20_000,
			cost: 5000,
			name: "Add-on",
			sessionChipPurchaseId: "p-add",
		});
	});
});

describe("time bounds", () => {
	it("blocks a time that would cross the neighbouring events", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useEventEditorSheet({
				chipPurchaseOptions: PURCHASE_OPTIONS,
				isTournament: false,
				maxTime: new Date(2026, 5, 1, 23, 0),
				minTime: new Date(2026, 5, 1, 22, 0),
				occupiedSeatPositions: new Set<number>(),
				onSubmit,
				seatCount: 9,
				seatablePlayers: SEATABLE_PLAYERS,
				target: editTarget("memo", { payload: { text: "note" } }),
			})
		);

		expect(result.current.timeValidator("21:59")).toBe("Must be after 22:00");
		expect(result.current.timeValidator("23:01")).toBe("Must be before 23:00");
		expect(result.current.timeValidator("22:30")).toBeUndefined();
	});
});

describe("seat editing", () => {
	function joinTarget(payload: unknown) {
		return editTarget("seat", { eventType: "player_join", payload });
	}

	it("records the new seat in the event payload the table is derived from", async () => {
		const { onSubmit, result } = setup(
			joinTarget({ playerId: "player-1", seatPosition: 7 })
		);

		expect(result.current.isSeatEditable).toBe(true);
		expect(result.current.form.state.values.seatNumber).toBe("8");

		act(() => {
			result.current.form.setFieldValue("seatNumber", "3");
		});
		await submit(result.current.form);

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				payload: { playerId: "player-1", seatPosition: 2 },
			})
		);
	});

	it("reassigns the seating event to another player", async () => {
		const { onSubmit, result } = setup(
			joinTarget({ playerId: "player-1", seatPosition: 7 })
		);

		act(() => {
			result.current.form.setFieldValue("playerId", "player-2");
		});
		await submit(result.current.form);

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				payload: { playerId: "player-2", seatPosition: 7 },
			})
		);
	});

	it("narrows the player candidates by the search query", () => {
		const { result } = setup(
			joinTarget({ playerId: "player-1", seatPosition: 7 })
		);

		expect(result.current.playerCandidates).toEqual([
			expect.objectContaining({ key: "player-1", meta: "Seat S3" }),
			expect.objectContaining({ key: "player-2", meta: "Not seated" }),
		]);

		act(() => {
			result.current.onPlayerQueryChange("red");
		});

		expect(result.current.playerCandidates).toEqual([
			expect.objectContaining({ key: "player-2", name: "Red cap" }),
		]);
	});

	it("rejects a seat outside the table", async () => {
		const { onSubmit, result } = setup(
			joinTarget({ playerId: "player-1", seatPosition: 0 })
		);

		act(() => {
			result.current.form.setFieldValue("seatNumber", "10");
		});
		await submit(result.current.form);

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("keeps a hero seating event time-only because its seat is owned by the session", async () => {
		const { onSubmit, result } = setup(
			joinTarget({ isHero: true, seatPosition: 6 })
		);

		expect(result.current.isSeatEditable).toBe(false);
		expect(result.current.isHeroSeatEvent).toBe(true);

		await submit(result.current.form);

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ payload: null })
		);
	});

	it("refuses to move a player onto a seat another player already holds", async () => {
		const { onSubmit, result } = setup(
			joinTarget({ playerId: "player-1", seatPosition: 7 }),
			false,
			new Set([2, 7])
		);

		act(() => {
			result.current.form.setFieldValue("seatNumber", "3");
		});
		await submit(result.current.form);

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("refuses to move a player onto the hero seat", async () => {
		const { onSubmit, result } = setup(
			joinTarget({ playerId: "player-1", seatPosition: 7 }),
			false,
			withHeroSeat(new Set([7]), 4)
		);

		act(() => {
			result.current.form.setFieldValue("seatNumber", "5");
		});
		await submit(result.current.form);

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("accepts a submit that leaves the player on its own seat", async () => {
		const { onSubmit, result } = setup(
			joinTarget({ playerId: "player-1", seatPosition: 7 }),
			false,
			new Set([7])
		);

		await submit(result.current.form);

		expect(onSubmit).toHaveBeenCalled();
	});

	it("keeps a leave event time-only", () => {
		const { result } = setup(
			editTarget("seat", {
				eventType: "player_leave",
				payload: { playerId: "player-1" },
			})
		);

		expect(result.current.isSeatEditable).toBe(false);
	});
});
