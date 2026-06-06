import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionFormValues } from "@/features/sessions/hooks/use-sessions";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	createTag: vi.fn(),
	lastFilters: undefined as unknown,
	lastRoomId: "sentinel" as string | undefined,
	sessions: [] as Array<{ id: string }>,
	availableTags: [] as Array<{ id: string; name: string }>,
	isLoading: false,
	isCreatePending: false,
}));

vi.mock("@/features/sessions/hooks/use-sessions", () => ({
	useSessions: (filters: unknown) => {
		mocks.lastFilters = filters;
		return {
			sessions: mocks.sessions,
			availableTags: mocks.availableTags,
			isLoading: mocks.isLoading,
			isCreatePending: mocks.isCreatePending,
			create: mocks.create,
			update: vi.fn(),
			delete: vi.fn(),
			reopen: vi.fn(),
			createTag: mocks.createTag,
		};
	},
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

import { useSessionsPage } from "@/features/sessions/pages/sessions-page/use-sessions-page";

const cashValues: SessionFormValues = {
	type: "cash_game",
	sessionDate: "2026-01-15",
	buyIn: 100,
	cashOut: 250,
} as SessionFormValues;

describe("useSessionsPage", () => {
	beforeEach(() => {
		mocks.create.mockReset().mockResolvedValue(undefined);
		mocks.createTag.mockReset().mockResolvedValue({ id: "t1", name: "Live" });
		mocks.lastFilters = undefined;
		mocks.lastRoomId = "sentinel";
		mocks.sessions = [];
		mocks.availableTags = [];
		mocks.isLoading = false;
		mocks.isCreatePending = false;
	});

	describe("initial state", () => {
		it("has both sheets closed by default", () => {
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.isCreateOpen).toBe(false);
			expect(result.current.isTagManagerOpen).toBe(false);
		});

		it("starts with empty filters and forwards them to useSessions", () => {
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.filters).toEqual({});
			expect(mocks.lastFilters).toEqual({});
		});

		it("passes undefined room id to useRoomGames before a room is picked", () => {
			renderHook(() => useSessionsPage());
			expect(mocks.lastRoomId).toBeUndefined();
		});

		it("forwards sessions, rooms, and currencies through", () => {
			mocks.sessions = [{ id: "s1" }];
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.sessions).toEqual([{ id: "s1" }]);
			expect(result.current.rooms).toEqual([{ id: "r1", name: "Aria" }]);
			expect(result.current.currencies).toEqual([{ id: "c1", name: "USD" }]);
		});

		it("forwards isLoading from the data hook", () => {
			mocks.isLoading = true;
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.isLoading).toBe(true);
		});

		it("forwards isCreatePending from the data hook", () => {
			mocks.isCreatePending = true;
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.isCreatePending).toBe(true);
		});
	});

	describe("setFilters", () => {
		it("re-queries useSessions with the new filters", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setFilters({ type: "tournament" });
			});
			expect(result.current.filters).toEqual({ type: "tournament" });
			expect(mocks.lastFilters).toEqual({ type: "tournament" });
		});
	});

	describe("setSelectedRoomId", () => {
		it("feeds the selected room into useRoomGames", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setSelectedRoomId("r1");
			});
			expect(mocks.lastRoomId).toBe("r1");
		});
	});

	describe("handleCreateOpenChange", () => {
		it("opens the create sheet", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleCreateOpenChange(true);
			});
			expect(result.current.isCreateOpen).toBe(true);
		});

		it("clears the selected room when the sheet closes", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setSelectedRoomId("r1");
			});
			act(() => {
				result.current.handleCreateOpenChange(false);
			});
			expect(mocks.lastRoomId).toBeUndefined();
			expect(result.current.isCreateOpen).toBe(false);
		});
	});

	describe("handleCreate", () => {
		it("forwards values to create()", async () => {
			const { result } = renderHook(() => useSessionsPage());
			await act(async () => {
				result.current.handleCreate(cashValues);
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledTimes(1);
			expect(mocks.create).toHaveBeenCalledWith(cashValues);
		});

		it("closes the create sheet after create resolves", async () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.handleCreateOpenChange(true);
			});
			await act(async () => {
				result.current.handleCreate(cashValues);
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});

		it("clears the selected room after create resolves", async () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setSelectedRoomId("r1");
			});
			await act(async () => {
				result.current.handleCreate(cashValues);
				await Promise.resolve();
			});
			await waitFor(() => expect(mocks.lastRoomId).toBeUndefined());
		});
	});

	describe("setIsTagManagerOpen", () => {
		it("opens the tag manager sheet", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setIsTagManagerOpen(true);
			});
			expect(result.current.isTagManagerOpen).toBe(true);
		});
	});

	describe("createTag", () => {
		it("delegates to the data hook's createTag", async () => {
			const { result } = renderHook(() => useSessionsPage());
			await act(async () => {
				await result.current.createTag("Live");
			});
			expect(mocks.createTag).toHaveBeenCalledTimes(1);
			expect(mocks.createTag).toHaveBeenCalledWith("Live");
		});
	});
});
