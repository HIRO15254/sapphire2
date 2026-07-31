import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionFormValues } from "@/features/sessions/hooks/use-sessions";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	update: vi.fn(),
	deleteSession: vi.fn(),
	reopen: vi.fn(),
	createTag: vi.fn(),
	lastRoomId: "sentinel" as string | undefined,
	session: null as {
		id: string;
		roomId: string | null;
		type: string;
		liveCashGameSessionId: string | null;
		liveTournamentSessionId: string | null;
	} | null,
	isLoading: false,
	isUpdatePending: false,
	submitLiveEventEdits: vi.fn(),
	disabledResultFields: new Set<string>(),
	endDateHint: null as string | null,
	requiredResultFields: new Set<string>(),
	startDateHint: null as string | null,
	isEventUpdatePending: false,
	lastLiveEditArgs: null as {
		displayedDate: string;
		isEditOpen: boolean;
		isLiveLinked: boolean;
		sessionId: string;
		sessionType: string;
	} | null,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/features/sessions/hooks/use-session-detail", () => ({
	useSessionDetail: () => ({
		session: mocks.session,
		availableTags: [{ id: "tag-1", name: "Live" }],
		isLoading: mocks.isLoading,
		isUpdatePending: mocks.isUpdatePending,
		update: mocks.update,
		deleteSession: mocks.deleteSession,
		reopen: mocks.reopen,
		createTag: mocks.createTag,
	}),
}));

vi.mock(
	"@/features/sessions/pages/session-detail-page/use-live-linked-session-edit",
	() => ({
		useLiveLinkedSessionEdit: (args: {
			displayedDate: string;
			isEditOpen: boolean;
			isLiveLinked: boolean;
			sessionId: string;
			sessionType: string;
		}) => {
			mocks.lastLiveEditArgs = args;
			return {
				disabledResultFields: mocks.disabledResultFields,
				endDateHint: mocks.endDateHint,
				requiredResultFields: mocks.requiredResultFields,
				startDateHint: mocks.startDateHint,
				isEventUpdatePending: mocks.isEventUpdatePending,
				submitLiveEventEdits: mocks.submitLiveEventEdits,
			};
		},
	})
);

vi.mock("@/features/rooms/hooks/use-room-games", () => ({
	useEntityLists: () => ({
		rooms: [{ id: "r1", name: "Aria" }],
		currencies: [{ id: "c1", name: "USD" }],
	}),
	useRoomGames: (roomId: string | undefined) => {
		mocks.lastRoomId = roomId;
		return { ringGames: [], tournaments: [] };
	},
}));

import { useSessionDetailPage } from "@/features/sessions/pages/session-detail-page/use-session-detail-page";

const manualCash = {
	id: "s1",
	roomId: "r1",
	type: "cash_game",
	liveCashGameSessionId: null,
	liveTournamentSessionId: null,
};
const liveCash = {
	id: "s2",
	roomId: "r1",
	type: "cash_game",
	liveCashGameSessionId: "s2",
	liveTournamentSessionId: null,
};
const liveTournament = {
	id: "s3",
	roomId: null,
	type: "tournament",
	liveCashGameSessionId: null,
	liveTournamentSessionId: "s3",
};

const cashValues: SessionFormValues = {
	type: "cash_game",
	sessionDate: "2026-01-15",
	buyIn: 100,
	cashOut: 250,
} as SessionFormValues;

describe("useSessionDetailPage", () => {
	beforeEach(() => {
		mocks.navigate.mockReset();
		mocks.update.mockReset().mockResolvedValue(undefined);
		mocks.deleteSession.mockReset();
		mocks.reopen.mockReset();
		mocks.createTag
			.mockReset()
			.mockResolvedValue({ id: "tag-1", name: "Live" });
		mocks.lastRoomId = "sentinel";
		mocks.session = manualCash;
		mocks.isLoading = false;
		mocks.isUpdatePending = false;
		mocks.submitLiveEventEdits.mockReset().mockResolvedValue(true);
		mocks.disabledResultFields = new Set<string>();
		mocks.endDateHint = null;
		mocks.requiredResultFields = new Set<string>();
		mocks.startDateHint = null;
		mocks.isEventUpdatePending = false;
		mocks.lastLiveEditArgs = null;
	});

	describe("initial state", () => {
		it("has all sheets and dialogs closed", () => {
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isActionsOpen).toBe(false);
			expect(result.current.isEditOpen).toBe(false);
			expect(result.current.confirmingDelete).toBe(false);
		});

		it("forwards session, rooms, currencies, and tags", () => {
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.session).toBe(manualCash);
			expect(result.current.rooms).toEqual([{ id: "r1", name: "Aria" }]);
			expect(result.current.currencies).toEqual([{ id: "c1", name: "USD" }]);
			expect(result.current.availableTags).toEqual([
				{ id: "tag-1", name: "Live" },
			]);
		});

		it("forwards isLoading and isUpdatePending", () => {
			mocks.isLoading = true;
			mocks.isUpdatePending = true;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isLoading).toBe(true);
			expect(result.current.isUpdatePending).toBe(true);
		});
	});

	describe("isLiveLinked / canReopen", () => {
		it("are both false for a manual session", () => {
			mocks.session = manualCash;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isLiveLinked).toBe(false);
			expect(result.current.canReopen).toBe(false);
		});

		it("are both true for a live cash game", () => {
			mocks.session = liveCash;
			const { result } = renderHook(() => useSessionDetailPage("s2"));
			expect(result.current.isLiveLinked).toBe(true);
			expect(result.current.canReopen).toBe(true);
		});

		it("treats a live tournament as live-linked but not reopenable", () => {
			mocks.session = liveTournament;
			const { result } = renderHook(() => useSessionDetailPage("s3"));
			expect(result.current.isLiveLinked).toBe(true);
			expect(result.current.canReopen).toBe(false);
		});

		it("are both false when the session has not loaded", () => {
			mocks.session = null;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isLiveLinked).toBe(false);
			expect(result.current.canReopen).toBe(false);
		});
	});

	describe("openEditFromActions", () => {
		it("closes actions, seeds the edit room, and opens the edit sheet", () => {
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			act(() => {
				result.current.setIsActionsOpen(true);
			});
			act(() => {
				result.current.openEditFromActions();
			});
			expect(result.current.isActionsOpen).toBe(false);
			expect(result.current.isEditOpen).toBe(true);
			expect(mocks.lastRoomId).toBe("r1");
		});
	});

	describe("openDeleteFromActions", () => {
		it("closes actions and opens the delete confirmation", () => {
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			act(() => {
				result.current.setIsActionsOpen(true);
			});
			act(() => {
				result.current.openDeleteFromActions();
			});
			expect(result.current.isActionsOpen).toBe(false);
			expect(result.current.confirmingDelete).toBe(true);
		});
	});

	describe("handleEdit", () => {
		it("forwards id + isLiveLinked + values to update for a manual session", async () => {
			mocks.session = manualCash;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			await act(async () => {
				await result.current.handleEdit(cashValues);
			});
			expect(mocks.update).toHaveBeenCalledTimes(1);
			expect(mocks.update).toHaveBeenCalledWith({
				id: "s1",
				isLiveLinked: false,
				...cashValues,
			});
		});

		it("marks a live session edit as live-linked", async () => {
			mocks.session = liveCash;
			const { result } = renderHook(() => useSessionDetailPage("s2"));
			await act(async () => {
				await result.current.handleEdit(cashValues);
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "s2",
				isLiveLinked: true,
				...cashValues,
			});
		});

		it("closes the edit sheet after update resolves", async () => {
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			act(() => {
				result.current.setIsEditOpen(true);
			});
			await act(async () => {
				await result.current.handleEdit(cashValues);
			});
			await waitFor(() => expect(result.current.isEditOpen).toBe(false));
		});

		it("does nothing when the session is not loaded", async () => {
			mocks.session = null;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			await act(async () => {
				await result.current.handleEdit(cashValues);
			});
			expect(mocks.update).not.toHaveBeenCalled();
			expect(mocks.submitLiveEventEdits).not.toHaveBeenCalled();
		});
	});

	// A live session's event-backed fields are written through
	// `sessionEvent.update` (session.update refuses them), so the event sync
	// runs first and a failure has to stop the save.
	describe("handleEdit — live-linked event sync", () => {
		it("syncs the events before updating the session metadata", async () => {
			mocks.session = liveCash;
			const order: string[] = [];
			mocks.submitLiveEventEdits.mockImplementation(() => {
				order.push("events");
				return Promise.resolve(true);
			});
			mocks.update.mockImplementation(() => {
				order.push("session");
				return Promise.resolve(undefined);
			});
			const { result } = renderHook(() => useSessionDetailPage("s2"));
			await act(async () => {
				await result.current.handleEdit(cashValues);
			});
			expect(order).toEqual(["events", "session"]);
			expect(mocks.submitLiveEventEdits).toHaveBeenCalledTimes(1);
			expect(mocks.submitLiveEventEdits).toHaveBeenCalledWith(cashValues);
		});

		it("keeps the sheet open and skips the session update when the sync fails", async () => {
			mocks.session = liveCash;
			mocks.submitLiveEventEdits.mockResolvedValue(false);
			const { result } = renderHook(() => useSessionDetailPage("s2"));
			act(() => {
				result.current.setIsEditOpen(true);
			});
			await act(async () => {
				await result.current.handleEdit(cashValues);
			});
			expect(mocks.update).not.toHaveBeenCalled();
			expect(result.current.isEditOpen).toBe(true);
		});

		it("keeps the sheet open when the session update itself rejects", async () => {
			mocks.update.mockRejectedValue(new Error("nope"));
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			act(() => {
				result.current.setIsEditOpen(true);
			});
			await act(async () => {
				await result.current.handleEdit(cashValues);
			});
			expect(result.current.isEditOpen).toBe(true);
		});

		it("passes the live-linked flag and session type to the event-sync hook", () => {
			mocks.session = liveTournament;
			renderHook(() => useSessionDetailPage("s3"));
			expect(mocks.lastLiveEditArgs).toMatchObject({
				isLiveLinked: true,
				sessionId: "s3",
				sessionType: "tournament",
			});
		});

		it("reports a manual session as not live-linked to the event-sync hook", () => {
			mocks.session = manualCash;
			renderHook(() => useSessionDetailPage("s1"));
			expect(mocks.lastLiveEditArgs).toMatchObject({
				isLiveLinked: false,
				sessionId: "s1",
				sessionType: "cash_game",
			});
		});

		it("passes the displayed date and sheet state to the event-sync hook", () => {
			mocks.session = { ...liveCash, sessionDate: "2026-04-11T03:00:00Z" };
			const { result } = renderHook(() => useSessionDetailPage("s2"));
			expect(mocks.lastLiveEditArgs?.displayedDate).toBe("2026-04-11");
			expect(mocks.lastLiveEditArgs?.isEditOpen).toBe(false);
			act(() => {
				result.current.openEditFromActions();
			});
			expect(mocks.lastLiveEditArgs?.isEditOpen).toBe(true);
		});

		it("exposes the end-day hint from the event-sync hook", () => {
			mocks.session = liveCash;
			mocks.endDateHint = "2026/04/11";
			const { result } = renderHook(() => useSessionDetailPage("s2"));
			expect(result.current.endDateHint).toBe("2026/04/11");
		});

		it("exposes the required result fields from the event-sync hook", () => {
			mocks.session = liveCash;
			mocks.requiredResultFields = new Set(["startTime"]);
			const { result } = renderHook(() => useSessionDetailPage("s2"));
			expect(result.current.requiredResultFields.has("startTime")).toBe(true);
		});

		it("exposes the disabled result fields from the event-sync hook", () => {
			mocks.session = liveCash;
			mocks.disabledResultFields = new Set(["buyIn"]);
			const { result } = renderHook(() => useSessionDetailPage("s2"));
			expect(result.current.disabledResultFields.has("buyIn")).toBe(true);
		});

		it("reports a pending event update as a pending save", () => {
			mocks.isEventUpdatePending = true;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			expect(result.current.isUpdatePending).toBe(true);
		});
	});

	describe("handleConfirmDelete", () => {
		it("deletes the session, closes the dialog, and navigates to the list", () => {
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			act(() => {
				result.current.handleConfirmDelete();
			});
			expect(mocks.deleteSession).toHaveBeenCalledTimes(1);
			expect(mocks.deleteSession).toHaveBeenCalledWith("s1");
			expect(result.current.confirmingDelete).toBe(false);
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/sessions" });
		});

		it("does nothing when the session is not loaded", () => {
			mocks.session = null;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			act(() => {
				result.current.handleConfirmDelete();
			});
			expect(mocks.deleteSession).not.toHaveBeenCalled();
			expect(mocks.navigate).not.toHaveBeenCalled();
		});
	});

	describe("handleReopen", () => {
		it("reopens the live cash game and closes the actions sheet", () => {
			mocks.session = liveCash;
			const { result } = renderHook(() => useSessionDetailPage("s2"));
			act(() => {
				result.current.setIsActionsOpen(true);
			});
			act(() => {
				result.current.handleReopen();
			});
			expect(mocks.reopen).toHaveBeenCalledTimes(1);
			expect(mocks.reopen).toHaveBeenCalledWith("s2");
			expect(result.current.isActionsOpen).toBe(false);
		});

		it("does not reopen a manual session", () => {
			mocks.session = manualCash;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			act(() => {
				result.current.handleReopen();
			});
			expect(mocks.reopen).not.toHaveBeenCalled();
		});
	});

	describe("createTag", () => {
		it("delegates to the data hook's createTag", async () => {
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			await act(async () => {
				await result.current.createTag("Live");
			});
			expect(mocks.createTag).toHaveBeenCalledTimes(1);
			expect(mocks.createTag).toHaveBeenCalledWith("Live");
		});
	});
});
