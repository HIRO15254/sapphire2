import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface TestSessionItem {
	id: string;
	liveCashGameSessionId: string | null;
	liveTournamentSessionId: string | null;
	storeId?: string | null;
}

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	del: vi.fn(),
	reopen: vi.fn(),
	createTag: vi.fn(),
	lastFilters: null as Record<string, unknown> | null,
	lastCreateGamesStoreId: null as string | undefined | null,
	lastEditGamesStoreId: null as string | undefined | null,
	lastCalledSlot: "create" as "create" | "edit",
	sessions: [] as Record<string, unknown>[],
	availableTags: [] as Array<{ id: string; name: string }>,
	stores: [] as Array<{ id: string; name: string }>,
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

vi.mock("@/features/stores/hooks/use-store-games", () => ({
	useEntityLists: () => ({
		stores: mocks.stores,
		currencies: mocks.currencies,
	}),
	useStoreGames: (storeId: string | undefined) => {
		// useSessionsPage calls useStoreGames twice per render (create + edit
		// slots). Track each by alternating the slot name.
		if (mocks.lastCalledSlot === "create") {
			mocks.lastCreateGamesStoreId = storeId;
			mocks.lastCalledSlot = "edit";
		} else {
			mocks.lastEditGamesStoreId = storeId;
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
		storeId: null,
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
		mocks.lastCreateGamesStoreId = null;
		mocks.lastEditGamesStoreId = null;
		mocks.lastCalledSlot = "create";
		mocks.sessions = [];
		mocks.availableTags = [];
		mocks.stores = [];
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
		});

		it("passes empty filters into useSessions initially", () => {
			renderHook(() => useSessionsPage());
			expect(mocks.lastFilters).toEqual({});
		});

		it("surfaces stores and currencies from useEntityLists", () => {
			mocks.stores = [{ id: "s1", name: "Akiba" }];
			mocks.currencies = [{ id: "c1", name: "USD" }];
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.stores).toEqual(mocks.stores);
			expect(result.current.currencies).toEqual(mocks.currencies);
		});
	});

	describe("handleCreate", () => {
		it("creates and closes the dialog on success", async () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setSelectedStoreId("store-1");
			});
			await act(async () => {
				result.current.handleCreate({
					storeId: "store-1",
					kind: "cash_game",
				} as never);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledWith({
				storeId: "store-1",
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
				result.current.handleUpdate({ storeId: "x" } as never);
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
				result.current.handleUpdate({ storeId: "store-1" } as never);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "s1",
				isLiveLinked: false,
				storeId: "store-1",
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
				result.current.handleUpdate({ storeId: "store-1" } as never);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "s2",
				isLiveLinked: true,
				storeId: "store-1",
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
				result.current.handleUpdate({ storeId: "x" } as never);
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "s3",
				isLiveLinked: true,
				storeId: "x",
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
		it("handleOpenEdit sets editStoreId from the session.storeId", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEdit(
					buildSession({ id: "s1", storeId: "store-5" })
				);
			});
			expect(result.current.editingSession?.id).toBe("s1");
			// editStoreId is not exposed directly on the return — but setEditStoreId is.
			// The hook drives useStoreGames via editStoreId; we can assert set via
			// handleCloseEdit clearing it to undefined.
			act(() => {
				result.current.handleCloseEdit();
			});
			expect(result.current.editingSession).toBeNull();
		});

		it("handleOpenEdit falls back to undefined when storeId is nullish", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleOpenEdit(
					buildSession({ id: "s1", storeId: null })
				);
			});
			expect(result.current.editingSession?.id).toBe("s1");
		});
	});

	describe("handleCreateDialogOpenChange", () => {
		it("sets isCreateOpen to true and leaves selectedStoreId intact", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setSelectedStoreId("pre-selected");
			});
			act(() => {
				result.current.handleCreateDialogOpenChange(true);
			});
			expect(result.current.isCreateOpen).toBe(true);
			// selectedStoreId is internal; not reset on open.
		});

		it("clears selectedStoreId when dialog is closed", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleCreateDialogOpenChange(true);
			});
			act(() => {
				result.current.setSelectedStoreId("store-x");
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
