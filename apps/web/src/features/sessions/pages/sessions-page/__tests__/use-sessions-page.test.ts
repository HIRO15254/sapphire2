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
	defaultPresetCalls: [] as Array<{ isUntouched: boolean; screenKey: string }>,
	lastApplyDefault: undefined as
		| ((payload: Record<string, unknown>) => void)
		| undefined,
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

// Spy wrapper, not a replacement: the real shared hook still runs (so the
// loading gate / one-shot guard is exercised end-to-end through the page hook),
// while every call records the `screenKey` + `isUntouched` verdict this hook
// computed and hands back its `applyDefault` for direct invocation.
vi.mock("@/shared/hooks/use-default-filter-preset", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/shared/hooks/use-default-filter-preset")
		>();
	return {
		useDefaultFilterPreset: (
			screenKey: "sessions" | "statistics",
			isUntouched: boolean,
			applyDefault: (payload: Record<string, unknown>) => void
		) => {
			mocks.defaultPresetCalls.push({ isUntouched, screenKey });
			mocks.lastApplyDefault = applyDefault;
			return actual.useDefaultFilterPreset(
				screenKey,
				isUntouched,
				applyDefault
			);
		},
	};
});

import { useSessionsPage } from "@/features/sessions/pages/sessions-page/use-sessions-page";

function lastDefaultPresetCall() {
	const call = mocks.defaultPresetCalls.at(-1);
	if (!call) {
		throw new Error("useDefaultFilterPreset was never called");
	}
	return call;
}

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
		mocks.defaultPresetCalls = [];
		mocks.lastApplyDefault = undefined;
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
		it("subscribes to the sessions screen's presets through the shared hook", () => {
			renderHook(() => useSessionsPage());
			expect(lastDefaultPresetCall().screenKey).toBe("sessions");
			expect(mocks.lastPresetsScreenKey).toBe("sessions");
		});

		// The preset CRUD surface is self-contained in FilterPresetsSheet ->
		// useFilterPresetsSheet -> useFilterPresets; re-exporting it here left ten
		// fields no consumer ever read (review finding 3).
		it("does not re-export the preset list or CRUD surface", () => {
			mocks.presets = [
				{ id: "p1", isDefault: false, payload: { type: "cash_game" } },
			];
			const { result } = renderHook(() => useSessionsPage());
			const returned = result.current as Record<string, unknown>;
			for (const key of [
				"presets",
				"defaultPreset",
				"isPresetsLoading",
				"isPresetCreatePending",
				"isPresetDeletePending",
				"isPresetSetDefaultPending",
				"createPreset",
				"removePreset",
				"setDefaultPreset",
				"clearDefaultPreset",
			]) {
				expect(returned[key]).toBeUndefined();
			}
		});
	});

	describe("isUntouched verdict passed to useDefaultFilterPreset", () => {
		it("is true for the initial empty filter object", () => {
			renderHook(() => useSessionsPage());
			expect(lastDefaultPresetCall().isUntouched).toBe(true);
		});

		it("is true when every key present holds undefined", () => {
			// Picking "All" in the Type sheet leaves `{ type: undefined }` behind
			// because `patch` spreads `{ ...filters, ...next }`. Counting keys read
			// that as "the user set a filter" and suppressed the default preset
			// (review finding 1).
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setFilters({ type: undefined });
			});
			expect(result.current.filters).toEqual({ type: undefined });
			expect(lastDefaultPresetCall().isUntouched).toBe(true);
		});

		it("is true when several cleared keys linger", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setFilters({
					type: undefined,
					roomId: undefined,
					currencyId: undefined,
				});
			});
			expect(lastDefaultPresetCall().isUntouched).toBe(true);
		});

		it("is false once a filter holds a real value", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setFilters({ roomId: "r1" });
			});
			expect(lastDefaultPresetCall().isUntouched).toBe(false);
		});

		it("is false for a falsy-but-real epoch bound of 0", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setFilters({ period: "custom", from: 0 });
			});
			expect(lastDefaultPresetCall().isUntouched).toBe(false);
		});

		it("is false when a real value sits next to a cleared key", () => {
			const { result } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setFilters({ type: undefined, roomId: "r1" });
			});
			expect(lastDefaultPresetCall().isUntouched).toBe(false);
		});
	});

	describe("default preset display mode", () => {
		it("turns BB/BI on for a normalized default preset", async () => {
			mocks.presets = [
				{
					id: "p1",
					isDefault: true,
					payload: { type: "cash_game", display: "normalized" },
				},
			];
			const { result } = renderHook(() => useSessionsPage());
			await waitFor(() => expect(result.current.bbBiMode).toBe(true));
		});

		it("does not leak the display key into the filter values", async () => {
			mocks.presets = [
				{
					id: "p1",
					isDefault: true,
					payload: { type: "cash_game", display: "normalized" },
				},
			];
			const { result } = renderHook(() => useSessionsPage());
			await waitFor(() => {
				expect(result.current.filters).toEqual({ type: "cash_game" });
			});
			expect(mocks.lastFilters).toEqual({ type: "cash_game" });
			expect(
				"display" in (result.current.filters as Record<string, unknown>)
			).toBe(false);
		});

		it("turns BB/BI off for a currency default preset", async () => {
			mocks.isPresetsLoading = true;
			const { result, rerender } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setBbBiMode(true);
			});

			mocks.isPresetsLoading = false;
			mocks.presets = [
				{ id: "p1", isDefault: true, payload: { display: "currency" } },
			];
			rerender();

			await waitFor(() => expect(result.current.bbBiMode).toBe(false));
		});

		it("leaves BB/BI on when the default preset predates the display field", async () => {
			mocks.isPresetsLoading = true;
			const { result, rerender } = renderHook(() => useSessionsPage());
			act(() => {
				result.current.setBbBiMode(true);
			});

			mocks.isPresetsLoading = false;
			mocks.presets = [
				{ id: "p1", isDefault: true, payload: { type: "tournament" } },
			];
			rerender();

			await waitFor(() => {
				expect(result.current.filters).toEqual({ type: "tournament" });
			});
			expect(result.current.bbBiMode).toBe(true);
		});

		it("leaves BB/BI off when the default preset predates the display field", async () => {
			mocks.presets = [
				{ id: "p1", isDefault: true, payload: { type: "tournament" } },
			];
			const { result } = renderHook(() => useSessionsPage());
			await waitFor(() => {
				expect(result.current.filters).toEqual({ type: "tournament" });
			});
			expect(result.current.bbBiMode).toBe(false);
		});

		it("applies both halves when applyDefault is invoked directly", async () => {
			mocks.presets = [];
			const { result } = renderHook(() => useSessionsPage());
			await act(async () => {
				await Promise.resolve();
			});
			act(() => {
				mocks.lastApplyDefault?.({
					period: "30d",
					roomId: "r1",
					display: "normalized",
				});
			});
			expect(result.current.filters).toEqual({ period: "30d", roomId: "r1" });
			expect(result.current.bbBiMode).toBe(true);
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

		it("still applies the default preset when the user only cleared a chip before presets loaded", async () => {
			mocks.isPresetsLoading = true;
			mocks.presets = [];
			const { result, rerender } = renderHook(() => useSessionsPage());
			// "All" in the Type sheet — no filter is actually active.
			act(() => {
				result.current.setFilters({ type: undefined });
			});

			mocks.isPresetsLoading = false;
			mocks.presets = [
				{ id: "p1", isDefault: true, payload: { roomId: "r1" } },
			];
			rerender();

			await waitFor(() => {
				expect(result.current.filters).toEqual({ roomId: "r1" });
			});
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
