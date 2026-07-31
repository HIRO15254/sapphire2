import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import type { SessionFormValues } from "@/features/sessions/utils/session-form-helpers";

const mocks = vi.hoisted(() => ({
	toastError: vi.fn(),
	update: vi.fn(),
	useSessionEvents: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/features/live-sessions/hooks/use-session-events", () => ({
	useSessionEvents: mocks.useSessionEvents,
}));

import { useLiveLinkedSessionEdit } from "@/features/sessions/pages/session-detail-page/use-live-linked-session-edit";

function localIso(
	year: number,
	month: number,
	day: number,
	hours: number,
	minutes: number
): string {
	return new Date(year, month - 1, day, hours, minutes).toISOString();
}

function unix(
	year: number,
	month: number,
	day: number,
	hours: number,
	minutes: number
): number {
	return Math.floor(
		new Date(year, month - 1, day, hours, minutes).getTime() / 1000
	);
}

const SESSION_START: SessionEvent = {
	id: "e-start",
	eventType: "session_start",
	occurredAt: localIso(2026, 4, 10, 20, 0),
	payload: { buyInAmount: 10_000 },
};
const SESSION_END: SessionEvent = {
	id: "e-end",
	eventType: "session_end",
	occurredAt: localIso(2026, 4, 10, 23, 0),
	payload: { cashOutAmount: 11_500 },
};

const VALUES: SessionFormValues = {
	type: "cash_game",
	sessionDate: "2026-04-10",
	startTime: "20:00",
	endTime: "23:00",
	buyIn: 10_000,
	cashOut: 11_500,
	variant: "No Limit Hold'em",
};

function setEvents(events: SessionEvent[]) {
	mocks.useSessionEvents.mockImplementation(() => ({
		events,
		update: mocks.update,
		isUpdatePending: false,
	}));
}

function renderEditHook(isLiveLinked = true, isEditOpen = true) {
	return renderHook(
		(props: { isEditOpen: boolean }) =>
			useLiveLinkedSessionEdit({
				displayedDate: "2026-04-10",
				isEditOpen: props.isEditOpen,
				isLiveLinked,
				sessionId: "s1",
				sessionType: "cash_game",
			}),
		{ initialProps: { isEditOpen } }
	);
}

const MOVED_END: SessionEvent = {
	...SESSION_END,
	occurredAt: localIso(2026, 4, 11, 3, 0),
};

describe("useLiveLinkedSessionEdit", () => {
	beforeEach(() => {
		mocks.toastError.mockReset();
		mocks.update.mockReset();
		mocks.update.mockResolvedValue({ id: "e-end" });
		mocks.useSessionEvents.mockReset();
		setEvents([SESSION_START, SESSION_END]);
	});

	describe("event query wiring", () => {
		it("subscribes to the session's events when the session is live-linked", () => {
			renderEditHook();
			expect(mocks.useSessionEvents).toHaveBeenCalledWith({
				sessionId: "s1",
				sessionType: "cash_game",
			});
		});

		it("passes an empty id for a manual session so the query stays disabled", () => {
			renderEditHook(false);
			expect(mocks.useSessionEvents).toHaveBeenCalledWith({
				sessionId: "",
				sessionType: "cash_game",
			});
		});
	});

	describe("disabledResultFields", () => {
		it("disables the aggregated fields but not the event-backed ones", () => {
			const { result } = renderEditHook();
			expect(result.current.disabledResultFields.has("buyIn")).toBe(true);
			expect(result.current.disabledResultFields.has("cashOut")).toBe(false);
			expect(result.current.disabledResultFields.has("startTime")).toBe(false);
		});

		it("keeps the session date locked (a day move is not a single-event edit)", () => {
			const { result } = renderEditHook();
			expect(result.current.disabledResultFields.has("sessionDate")).toBe(true);
		});

		it("disables the end-backed fields while the session has no session_end", () => {
			setEvents([SESSION_START]);
			const { result } = renderEditHook();
			expect(result.current.disabledResultFields.has("cashOut")).toBe(true);
			expect(result.current.disabledResultFields.has("endTime")).toBe(true);
		});

		it("disables everything until the events have loaded", () => {
			setEvents([]);
			const { result } = renderEditHook();
			expect(result.current.disabledResultFields.has("cashOut")).toBe(true);
			expect(result.current.disabledResultFields.has("startTime")).toBe(true);
		});

		it("disables nothing for a manual session", () => {
			const { result } = renderEditHook(false);
			expect(result.current.disabledResultFields.size).toBe(0);
		});
	});

	describe("day hints", () => {
		it("are null when both times sit on the displayed day", () => {
			const { result } = renderEditHook();
			expect(result.current.endDateHint).toBeNull();
			expect(result.current.startDateHint).toBeNull();
		});

		it("labels the end day when the session crossed midnight", () => {
			setEvents([SESSION_START, MOVED_END]);
			const { result } = renderEditHook();
			expect(result.current.endDateHint).toBe("2026/04/11");
			expect(result.current.startDateHint).toBeNull();
		});

		it("labels the start day too when the displayed date is behind the times", () => {
			const { result } = renderHook(() =>
				useLiveLinkedSessionEdit({
					displayedDate: "2026-04-09",
					isEditOpen: true,
					isLiveLinked: true,
					sessionId: "s1",
					sessionType: "cash_game",
				})
			);
			expect(result.current.startDateHint).toBe("2026/04/10");
			expect(result.current.endDateHint).toBe("2026/04/10");
		});

		it("are null for a manual session", () => {
			const { result } = renderEditHook(false);
			expect(result.current.endDateHint).toBeNull();
			expect(result.current.startDateHint).toBeNull();
		});
	});

	// The Events section lives inside the same sheet, so it can move the very
	// events the form was seeded from. The form must diff against the seed, not
	// against the refreshed events, or saving would undo the Events-side edit.
	describe("concurrent Events-section edits", () => {
		it("does not revert an event the Events section changed while the sheet was open", async () => {
			const { rerender, result } = renderEditHook();
			setEvents([SESSION_START, MOVED_END]);
			rerender({ isEditOpen: true });
			await act(async () => {
				await result.current.submitLiveEventEdits(VALUES);
			});
			expect(mocks.update).not.toHaveBeenCalled();
		});

		it("re-seeds after the sheet is closed and reopened", async () => {
			const { rerender, result } = renderEditHook();
			setEvents([SESSION_START, MOVED_END]);
			rerender({ isEditOpen: false });
			rerender({ isEditOpen: true });
			await act(async () => {
				await result.current.submitLiveEventEdits(VALUES);
			});
			expect(mocks.update).toHaveBeenCalledTimes(1);
			expect(mocks.update).toHaveBeenNthCalledWith(1, {
				id: "e-end",
				occurredAt: unix(2026, 4, 11, 23, 0),
			});
		});
	});

	describe("submitLiveEventEdits", () => {
		it("resolves true without touching the events when nothing changed", async () => {
			const { result } = renderEditHook();
			let outcome: boolean | undefined;
			await act(async () => {
				outcome = await result.current.submitLiveEventEdits(VALUES);
			});
			expect(outcome).toBe(true);
			expect(mocks.update).not.toHaveBeenCalled();
		});

		it("resolves true without touching the events for a manual session", async () => {
			const { result } = renderEditHook(false);
			let outcome: boolean | undefined;
			await act(async () => {
				outcome = await result.current.submitLiveEventEdits({
					...VALUES,
					cashOut: 99_999,
				});
			});
			expect(outcome).toBe(true);
			expect(mocks.update).not.toHaveBeenCalled();
		});

		it("syncs a changed cash-out to the session_end event", async () => {
			const { result } = renderEditHook();
			let outcome: boolean | undefined;
			await act(async () => {
				outcome = await result.current.submitLiveEventEdits({
					...VALUES,
					cashOut: 12_000,
				});
			});
			expect(outcome).toBe(true);
			expect(mocks.update).toHaveBeenCalledTimes(1);
			expect(mocks.update).toHaveBeenNthCalledWith(1, {
				id: "e-end",
				payload: { cashOutAmount: 12_000 },
			});
		});

		it("applies the end edit before the start edit when the end moves later", async () => {
			const { result } = renderEditHook();
			await act(async () => {
				await result.current.submitLiveEventEdits({
					...VALUES,
					startTime: "21:00",
					endTime: "23:30",
				});
			});
			expect(mocks.update).toHaveBeenCalledTimes(2);
			expect(mocks.update).toHaveBeenNthCalledWith(1, {
				id: "e-end",
				occurredAt: unix(2026, 4, 10, 23, 30),
			});
			expect(mocks.update).toHaveBeenNthCalledWith(2, {
				id: "e-start",
				occurredAt: unix(2026, 4, 10, 21, 0),
			});
		});

		it("reports a validation error and writes nothing", async () => {
			const { result } = renderEditHook();
			let outcome: boolean | undefined;
			await act(async () => {
				outcome = await result.current.submitLiveEventEdits({
					...VALUES,
					startTime: "23:30",
				});
			});
			expect(outcome).toBe(false);
			expect(mocks.update).not.toHaveBeenCalled();
			expect(mocks.toastError).toHaveBeenCalledTimes(1);
			expect(mocks.toastError).toHaveBeenCalledWith(
				"Start time must not be after the next event (23:00)"
			);
		});

		it("stops at the first rejected edit and leaves the error toast to the mutation cache", async () => {
			mocks.update.mockRejectedValueOnce(new Error("occurredAt would follow"));
			const { result } = renderEditHook();
			let outcome: boolean | undefined;
			await act(async () => {
				outcome = await result.current.submitLiveEventEdits({
					...VALUES,
					startTime: "21:00",
					endTime: "23:30",
				});
			});
			expect(outcome).toBe(false);
			expect(mocks.update).toHaveBeenCalledTimes(1);
			expect(mocks.toastError).not.toHaveBeenCalled();
		});
	});
});
