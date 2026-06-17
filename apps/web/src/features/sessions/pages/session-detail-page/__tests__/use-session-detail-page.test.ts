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
	flight: null as unknown,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("@/features/sessions/hooks/use-session-flight", () => ({
	useSessionFlight: () => mocks.flight,
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
				result.current.handleEdit(cashValues);
				await Promise.resolve();
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
				result.current.handleEdit(cashValues);
				await Promise.resolve();
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
				result.current.handleEdit(cashValues);
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isEditOpen).toBe(false));
		});

		it("does nothing when the session is not loaded", () => {
			mocks.session = null;
			const { result } = renderHook(() => useSessionDetailPage("s1"));
			act(() => {
				result.current.handleEdit(cashValues);
			});
			expect(mocks.update).not.toHaveBeenCalled();
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
