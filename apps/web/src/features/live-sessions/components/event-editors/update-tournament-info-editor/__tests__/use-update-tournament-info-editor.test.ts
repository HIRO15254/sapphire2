import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUpdateTournamentInfoEditor } from "@/features/live-sessions/components/event-editors/update-tournament-info-editor/use-update-tournament-info-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

const MUST_BE_AFTER = /Must be after/;
const MUST_BE_BEFORE = /Must be before/;

function event(
	payload: Record<string, unknown>,
	occurredAt = "2026-04-10T13:00:00"
): SessionEvent {
	return {
		id: "e1",
		eventType: "update_tournament_info",
		payload,
		occurredAt,
	};
}

describe("useUpdateTournamentInfoEditor", () => {
	it("defaults all numeric fields to '' and counts to [] when payload is empty", () => {
		const { result } = renderHook(() =>
			useUpdateTournamentInfoEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values).toEqual({
			time: "13:00",
			remainingPlayers: "",
			totalEntries: "",
			chipPurchaseCounts: [],
		});
	});

	it("seeds chipPurchaseCounts from payload arrays", () => {
		const counts = [
			{ name: "Rebuy", count: 3, chipsPerUnit: 5000 },
			{ name: "Addon", count: 1, chipsPerUnit: 7000 },
		];
		const { result } = renderHook(() =>
			useUpdateTournamentInfoEditor({
				event: event({
					remainingPlayers: 20,
					totalEntries: 100,
					chipPurchaseCounts: counts,
				}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.form.state.values.remainingPlayers).toBe("20");
		expect(result.current.form.state.values.totalEntries).toBe("100");
		expect(result.current.form.state.values.chipPurchaseCounts).toEqual(counts);
	});

	it("submits with nulls when remainingPlayers/totalEntries are empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useUpdateTournamentInfoEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			{
				remainingPlayers: null,
				totalEntries: null,
				chipPurchaseCounts: [],
			},
			expect.any(Number)
		);
	});

	it("submits parsed numeric fields when populated", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useUpdateTournamentInfoEditor({
				event: event({}),
				isLoading: false,
				maxTime: null,
				minTime: null,
				onSubmit,
			})
		);
		act(() => {
			result.current.form.setFieldValue("remainingPlayers", "15");
			result.current.form.setFieldValue("totalEntries", "80");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ remainingPlayers: 15, totalEntries: 80 }),
			expect.any(Number)
		);
	});

	it("timeValidator respects bounds", () => {
		const { result } = renderHook(() =>
			useUpdateTournamentInfoEditor({
				event: event({}, "2026-04-10T13:00:00"),
				isLoading: false,
				maxTime: new Date("2026-04-10T14:00:00"),
				minTime: new Date("2026-04-10T12:00:00"),
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.timeValidator("11:30")).toMatch(MUST_BE_AFTER);
		expect(result.current.timeValidator("14:30")).toMatch(MUST_BE_BEFORE);
	});
});
