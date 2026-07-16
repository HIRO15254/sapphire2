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
	isInitialLoadError: false,
	isCreatePending: false,
	onRetry: vi.fn(),
	presetsCreate: vi.fn(),
	presetsRemove: vi.fn(),
	presetsSetDefault: vi.fn(),
	presetsClearDefault: vi.fn(),
	presets: [] as Array<{
		id: string;
		isDefault: boolean;
		payload: Record<string, unknown>;
	}>,
	isPresetsLoading: false,
	isPresetCreatePending: false,
	isPresetDeletePending: false,
	isPresetSetDefaultPending: false,
	lastPresetsScreenKey: undefined as string | undefined,
}));

vi.mock("@/features/sessions/hooks/use-sessions", () => ({
	useSessions: (filters: unknown) => {
		mocks.lastFilters = filters;
		return {
			sessions: mocks.sessions,
			availableTags: mocks.availableTags,
			isLoading: mocks.isLoading,
			isInitialLoadError: mocks.isInitialLoadError,
			hasNextPage: false,
			isFetchingNextPage: false,
			fetchNextPage: vi.fn(),
			onRetry: mocks.onRetry,
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

vi.mock("@/shared/hooks/use-filter-presets", () => ({
	useFilterPresets: (screenKey: string) => {
		mocks.lastPresetsScreenKey = screenKey;
		return {
			presets: mocks.presets,
			defaultPreset: mocks.presets.find((p) => p.isDefault) ?? null,
			isLoading: mocks.isPresetsLoading,
			isCreatePending: mocks.isPresetCreatePending,
			isDeletePending: mocks.isPresetDeletePending,
			isSetDefaultPending: mocks.isPresetSetDefaultPending,
			create: mocks.presetsCreate,
			remove: mocks.presetsRemove,
			setDefault: mocks.presetsSetDefault,
			clearDefault: mocks.presetsClearDefault,
		};
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
		mocks.presetsCreate.mockReset();
		mocks.presetsRemove.mockReset();
		mocks.presetsSetDefault.mockReset();
		mocks.presetsClearDefault.mockReset();
		mocks.presets = [];
		mocks.isPresetsLoading = false;
		mocks.isPresetCreatePending = false;
		mocks.isPresetDeletePending = false;
		mocks.isPresetSetDefaultPending = false;
		mocks.lastPresetsScreenKey = undefined;
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

		it("forwards the initial-load error state and retry callback", () => {
			mocks.isInitialLoadError = true;
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.isInitialLoadError).toBe(true);
			expect(result.current.onRetry).toBe(mocks.onRetry);
		});

		it("forwards isCreatePending from the data hook", () => {
			mocks.isCreatePending = true;
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.isCreatePending).toBe(true);
		});

		it("starts with BB/BI mode off", () => {
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.bbBiMode).toBe(false);
		});
	});

	describe("setBbBiMode", () => {
		it("toggles BB/BI mode on", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setBbBiMode(true);
			});
			expect(result.current.bbBiMode).toBe(true);
		});

		it("toggles BB/BI mode back off", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setBbBiMode(true);
			});
			act(() => {
				result.current.setBbBiMode(false);
			});
			expect(result.current.bbBiMode).toBe(false);
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

	describe("filter presets", () => {
		it("forwards the presets list and screenKey from useFilterPresets", () => {
			mocks.presets = [
				{ id: "p1", isDefault: false, payload: { type: "cash_game" } },
			];
			const { result } = renderHook(() => useSessionsPage());
			expect(result.current.presets).toEqual(mocks.presets);
			expect(mocks.lastPresetsScreenKey).toBe("sessions");
		});
	});

	describe("default preset auto-apply", () => {
		it("does not call setFilters when there are no presets", async () => {
			mocks.presets = [];
			const { result } = renderHook(() => useSessionsPage());
			await act(async () => {
				await Promise.resolve();
			});
			expect(result.current.filters).toEqual({});
			expect(mocks.lastFilters).toEqual({});
		});

		it("does not call setFilters when presets exist but none is default", async () => {
			mocks.presets = [
				{ id: "p1", isDefault: false, payload: { type: "cash_game" } },
			];
			const { result } = renderHook(() => useSessionsPage());
			await act(async () => {
				await Promise.resolve();
			});
			expect(result.current.filters).toEqual({});
		});

		it("applies the default preset's payload exactly once when filters are still empty", async () => {
			mocks.presets = [
				{ id: "p1", isDefault: true, payload: { type: "cash_game" } },
			];
			const { result } = renderHook(() => useSessionsPage());
			await waitFor(() => {
				expect(result.current.filters).toEqual({ type: "cash_game" });
			});
			expect(mocks.lastFilters).toEqual({ type: "cash_game" });
		});

		it("does not apply the default preset when the user already touched filters before presets finished loading", async () => {
			mocks.isPresetsLoading = true;
			mocks.presets = [];
			const { result, rerender } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setFilters({ roomId: "r1" });
			});

			mocks.isPresetsLoading = false;
			mocks.presets = [
				{ id: "p1", isDefault: true, payload: { type: "cash_game" } },
			];
			rerender();

			await act(async () => {
				await Promise.resolve();
			});
			expect(result.current.filters).toEqual({ roomId: "r1" });
		});

		it("waits for the presets query to finish loading before applying the default", async () => {
			mocks.isPresetsLoading = true;
			mocks.presets = [
				{ id: "p1", isDefault: true, payload: { type: "cash_game" } },
			];
			const { result, rerender } = renderHook(() => useSessionsPage());
			await act(async () => {
				await Promise.resolve();
			});
			expect(result.current.filters).toEqual({});

			mocks.isPresetsLoading = false;
			rerender();

			await waitFor(() => {
				expect(result.current.filters).toEqual({ type: "cash_game" });
			});
		});

		it("does not crash and skips auto-apply when the presets query errors", async () => {
			// A query error resolves through the same shape as "no data yet":
			// isLoading flips to false with an empty presets array.
			mocks.isPresetsLoading = false;
			mocks.presets = [];
			expect(() => renderHook(() => useSessionsPage())).not.toThrow();
			const { result } = renderHook(() => useSessionsPage());
			await act(async () => {
				await Promise.resolve();
			});
			expect(result.current.filters).toEqual({});
		});

		it("does not re-apply after presets or filters change following the first resolution", async () => {
			mocks.presets = [
				{ id: "p1", isDefault: true, payload: { type: "cash_game" } },
			];
			const { result, rerender } = renderHook(() => useSessionsPage());
			await waitFor(() => {
				expect(result.current.filters).toEqual({ type: "cash_game" });
			});

			act(() => {
				result.current.setFilters({});
			});
			mocks.presets = [
				{ id: "p2", isDefault: true, payload: { type: "tournament" } },
			];
			rerender();

			await act(async () => {
				await Promise.resolve();
			});
			expect(result.current.filters).toEqual({});
		});
	});
});
