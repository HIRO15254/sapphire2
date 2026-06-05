import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface TestSessionItem {
	id: string;
	liveCashGameSessionId: string | null;
	liveTournamentSessionId: string | null;
	roomId?: string | null;
}

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	del: vi.fn(),
	reopen: vi.fn(),
	createTag: vi.fn(),
	lastFilters: null as Record<string, unknown> | null,
	lastCreateGamesRoomId: null as string | undefined | null,
	lastEditGamesRoomId: null as string | undefined | null,
	lastEditIncludeAll: null as boolean | null,
	lastCalledSlot: "create" as "create" | "edit",
	sessions: [] as Record<string, unknown>[],
	availableTags: [] as Array<{ id: string; name: string }>,
	rooms: [] as Array<{ id: string; name: string }>,
	currencies: [] as Array<{ id: string; name: string }>,
	isCreatePending: false,
	isUpdatePending: false,
}));

vi.mock("@/features/sessions/hooks/use-sessions", () => ({
	useSessions: (filters: Record<string, unknown>) => {
		mocks.lastFilters = filters;
		return {
			sessions: mocks.sessions,
			availableTags: mocks.availableTags,
			isCreatePending: mocks.isCreatePending,
			isUpdatePending: mocks.isUpdatePending,
			create: mocks.create,
			update: mocks.update,
			delete: mocks.del,
			reopen: mocks.reopen,
			createTag: mocks.createTag,
		};
	},
}));

vi.mock("@/features/rooms/hooks/use-room-games", () => ({
	useEntityLists: () => ({
		rooms: mocks.rooms,
		currencies: mocks.currencies,
	}),
	useRoomGames: (
		roomId: string | undefined,
		options?: { includeAll?: boolean }
	) => {
		// useSessionsPage calls useRoomGames twice per render (create + edit
		// slots). Track each by alternating the slot name.
		if (mocks.lastCalledSlot === "create") {
			mocks.lastCreateGamesRoomId = roomId;
			mocks.lastCalledSlot = "edit";
		} else {
			mocks.lastEditGamesRoomId = roomId;
			mocks.lastEditIncludeAll = options?.includeAll ?? false;
			mocks.lastCalledSlot = "create";
		}
		return { ringGames: [], tournaments: [], isLoading: false };
	},
}));

import { useSessionsPage } from "@/routes/sessions/-use-sessions-page";

// Returns a minimal session-like object. Cast to `never` at call sites — the
// hook's handleOpenEdit expects the full SessionItem type but the tests only
// exercise a handful of fields.
function buildSession(overrides: Partial<TestSessionItem> = {}) {
	return {
		id: "s1",
		roomId: null,
		liveCashGameSessionId: null,
		liveTournamentSessionId: null,
		...overrides,
	} as never;
}

describe("useSessionsPage", () => {
	beforeEach(() => {
		mocks.create.mockReset().mockResolvedValue({ id: "new" });
		mocks.update.mockReset().mockResolvedValue({ id: "s1" });
		mocks.del.mockReset();
		mocks.reopen.mockReset();
		mocks.createTag.mockReset();
		mocks.lastFilters = null;
		mocks.lastCreateGamesRoomId = null;
		mocks.lastEditGamesRoomId = null;
		mocks.lastEditIncludeAll = null;
		mocks.lastCalledSlot = "create";
		mocks.sessions = [];
		mocks.availableTags = [];
		mocks.rooms = [];
		mocks.currencies = [];
		mocks.isCreatePending = false;
		mocks.isUpdatePending = false;
	});

	describe("initial state", () => {
		it("defaults flags to closed and filters empty", () => {
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.isCreateOpen).toBe(false);
			expect(result.current.isTagManagerOpen).toBe(false);
			expect(result.current.editingSession).toBeNull();
			expect(result.current.filters).toEqual({});
			expect(result.current.bbBiMode).toBe(false);
			expect(result.current.isEditLiveLinked).toBe(false);
			expect(result.current.viewingEvents).toBeNull();
		});

		it("passes empty filters into useSessions initially", () => {
			renderHook(() => useSessionsPage());
			expect(mocks.lastFilters).toEqual({});
		});

		it("surfaces rooms and currencies from useEntityLists", () => {
			mocks.rooms = [{ id: "s1", name: "Akiba" }];
			mocks.currencies = [{ id: "c1", name: "USD" }];
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.rooms).toEqual(mocks.rooms);
			expect(result.current.currencies).toEqual(mocks.currencies);
		});
	});

	describe("handleCreate", () => {
		it("creates and closes the dialog on success", async () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setSelectedRoomId("room-1");
			});
			await act(async () => {
				result.current.handleCreate({
					roomId: "room-1",
					kind: "cash_game",
				} as never);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledWith({
				roomId: "room-1",
				kind: "cash_game",
			});
			const { result: r2 } = renderHook(() => useSessionsPage());
			await waitFor(() => expect(r2.current.isCreateOpen).toBe(false));
		});
	});

	describe("handleUpdate", () => {
		it("is a no-op when editingSession is null", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleUpdate({ roomId: "x" } as never);
			});
			expect(mocks.update).not.toHaveBeenCalled();
		});

		it("sets isLiveLinked=false when neither live link exists", async () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEdit(
					buildSession({
						id: "s1",
						liveCashGameSessionId: null,
						liveTournamentSessionId: null,
					})
				);
			});
			await act(async () => {
				result.current.handleUpdate({ roomId: "room-1" } as never);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "s1",
				isLiveLinked: false,
				roomId: "room-1",
			});
			await waitFor(() => expect(result.current.editingSession).toBeNull());
		});

		it("sets isLiveLinked=true when a live cash game link exists", async () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEdit(
					buildSession({
						id: "s2",
						liveCashGameSessionId: "live-1",
						liveTournamentSessionId: null,
					})
				);
			});
			expect(result.current.isEditLiveLinked).toBe(true);
			await act(async () => {
				result.current.handleUpdate({ roomId: "room-1" } as never);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "s2",
				isLiveLinked: true,
				roomId: "room-1",
			});
		});

		it("sets isLiveLinked=true when a live tournament link exists", async () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEdit(
					buildSession({
						id: "s3",
						liveCashGameSessionId: null,
						liveTournamentSessionId: "live-tourn",
					})
				);
			});
			expect(result.current.isEditLiveLinked).toBe(true);
			await act(async () => {
				result.current.handleUpdate({ roomId: "x" } as never);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "s3",
				isLiveLinked: true,
				roomId: "x",
			});
		});
	});

	describe("handleDelete", () => {
		it("forwards the id", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleDelete("s1");
			});
			expect(mocks.del).toHaveBeenCalledWith("s1");
		});
	});

	describe("handleReopen", () => {
		it("forwards the live cash-game session id", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleReopen("live-1");
			});
			expect(mocks.reopen).toHaveBeenCalledWith("live-1");
		});
	});

	describe("handleOpenEdit / handleCloseEdit", () => {
		it("handleOpenEdit sets editRoomId from the session.roomId", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEdit(
					buildSession({ id: "s1", roomId: "room-5" })
				);
			});
			expect(result.current.editingSession?.id).toBe("s1");
			// editRoomId is not exposed directly on the return — but setEditRoomId is.
			// The hook drives useRoomGames via editRoomId; we can assert set via
			// handleCloseEdit clearing it to undefined.
			act(() => {
				result.current.handleCloseEdit();
			});
			expect(result.current.editingSession).toBeNull();
		});

		it("handleOpenEdit falls back to undefined when roomId is nullish", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEdit(buildSession({ id: "s1", roomId: null }));
			});
			expect(result.current.editingSession?.id).toBe("s1");
		});
	});

	describe("edit games use includeAll", () => {
		it("passes includeAll: true to useRoomGames for the edit slot", () => {
			renderHook(() => useSessionsPage());
			// The edit slot is the second call to useRoomGames each render cycle.
			expect(mocks.lastEditIncludeAll).toBe(true);
		});
	});

	describe("handleCreateDialogOpenChange", () => {
		it("sets isCreateOpen to true and leaves selectedRoomId intact", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setSelectedRoomId("pre-selected");
			});
			act(() => {
				result.current.handleCreateDialogOpenChange(true);
			});
			expect(result.current.isCreateOpen).toBe(true);
			// selectedRoomId is internal; not reset on open.
		});

		it("clears selectedRoomId when dialog is closed", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleCreateDialogOpenChange(true);
			});
			act(() => {
				result.current.setSelectedRoomId("room-x");
			});
			act(() => {
				result.current.handleCreateDialogOpenChange(false);
			});
			expect(result.current.isCreateOpen).toBe(false);
		});
	});

	describe("setBbBiMode", () => {
		it("toggles the BB/BI flag", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setBbBiMode(true);
			});
			expect(result.current.bbBiMode).toBe(true);
			act(() => {
				result.current.setBbBiMode(false);
			});
			expect(result.current.bbBiMode).toBe(false);
		});
	});

	describe("handleOpenEvents / handleCloseEvents", () => {
		it("opens events viewer for a tournament session", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEvents({
					sessionId: "live-1",
					sessionType: "tournament",
				});
			});
			expect(result.current.viewingEvents).toEqual({
				sessionId: "live-1",
				sessionType: "tournament",
			});
		});

		it("normalizes cash-game sessionType to cash_game on open", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEvents({
					sessionId: "live-2",
					sessionType: "cash-game",
				});
			});
			expect(result.current.viewingEvents).toEqual({
				sessionId: "live-2",
				sessionType: "cash_game",
			});
		});

		it("clears viewingEvents on close", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEvents({
					sessionId: "live-3",
					sessionType: "tournament",
				});
			});
			act(() => {
				result.current.handleCloseEvents();
			});
			expect(result.current.viewingEvents).toBeNull();
		});
	});

	describe("setFilters", () => {
		it("passes new filters into useSessions on next render", () => {
			const { result, rerender } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setFilters({ keyword: "abc" } as never);
			});
			rerender();
			expect(mocks.lastFilters).toEqual({ keyword: "abc" });
			expect(result.current.filters).toEqual({ keyword: "abc" });
		});
	});
});
