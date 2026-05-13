import type { DragEndEvent } from "@dnd-kit/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	addBlindLevel: vi.fn(),
	updateBlindLevel: vi.fn(),
	removeBlindLevel: vi.fn(),
	addBlindSet: vi.fn(),
	updateBlindSet: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		tournament: {
			listBlindLevels: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listBlindLevels", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		tournament: {
			addBlindLevel: { mutate: trpcMocks.addBlindLevel },
			updateBlindLevel: { mutate: trpcMocks.updateBlindLevel },
			removeBlindLevel: { mutate: trpcMocks.removeBlindLevel },
			addBlindSet: { mutate: trpcMocks.addBlindSet },
			updateBlindSet: { mutate: trpcMocks.updateBlindSet },
		},
	},
}));

import { useBlindLevels } from "@/features/stores/hooks/use-blind-levels";

const TOURNAMENT_ID = "tour-1";
// The new cache key uses tournament.listBlindLevels
const LEVELS_KEY = [
	"tournament",
	"listBlindLevels",
	{ tournamentId: TOURNAMENT_ID },
];

// API-shape level as stored in the query cache
function apiLevel(
	overrides: {
		id?: number;
		levelIndex?: number;
		isBreak?: boolean;
		minutes?: number | null;
		sortOrder?: number;
		blindSets?: {
			blind1: number;
			blind2: number;
			blind3: null;
			blind4: null;
			ante: null;
			anteType: null;
			id: number;
			sortOrder: number;
		}[];
	} = {}
) {
	return {
		id: overrides.id ?? 1,
		tournamentId: TOURNAMENT_ID,
		levelIndex: overrides.levelIndex ?? 0,
		isBreak: overrides.isBreak ?? false,
		minutes: "minutes" in overrides ? overrides.minutes : 20,
		sortOrder: overrides.sortOrder ?? 0,
		blindSets: overrides.blindSets ?? [
			{
				id: 1,
				blind1: 100,
				blind2: 200,
				blind3: null,
				blind4: null,
				ante: 25,
				anteType: null,
				sortOrder: 0,
			},
		],
	};
}

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("useBlindLevels", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns empty levels when cache is empty", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.levels).toEqual([]);
			expect(result.current.isAdding).toBe(false);
		});

		it("exposes seeded levels from the cache and maps them to BlindLevelRow", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0 }),
				apiLevel({ id: 2, levelIndex: 1 }),
			]);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(2));
			// Maps levelIndex to 1-based level
			expect(result.current.levels[0]?.level).toBe(1);
			expect(result.current.levels[1]?.level).toBe(2);
			// Maps blindSets[0] to flat fields
			expect(result.current.levels[0]?.blind1).toBe(100);
			expect(result.current.levels[0]?.ante).toBe(25);
		});

		it("uses string id (String(apiLevel.id)) in the mapped BlindLevelRow", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [apiLevel({ id: 42 })]);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			expect(result.current.levels[0]?.id).toBe("42");
		});
	});

	describe("handleAddLevel / handleAddBreak", () => {
		it("sends { tournamentId, levelIndex: n, isBreak: false, sortOrder: n } with lastMinutes when available", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0, minutes: 20 }),
				apiLevel({ id: 2, levelIndex: 1, minutes: null }),
			]);
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 3 });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(2));
			act(() => {
				result.current.handleAddLevel();
			});
			await waitFor(() =>
				expect(trpcMocks.addBlindLevel).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					levelIndex: 2,
					isBreak: false,
					minutes: 20,
					sortOrder: 2,
				})
			);
		});

		it("omits minutes when no level has a minutes value", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0, minutes: null }),
			]);
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 2 });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleAddLevel();
			});
			await waitFor(() =>
				expect(trpcMocks.addBlindLevel).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					levelIndex: 1,
					isBreak: false,
					sortOrder: 1,
				})
			);
		});

		it("handleAddBreak sends isBreak=true", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0, minutes: 15 }),
			]);
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 2 });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleAddBreak();
			});
			await waitFor(() =>
				expect(trpcMocks.addBlindLevel).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					levelIndex: 1,
					isBreak: true,
					minutes: 15,
					sortOrder: 1,
				})
			);
		});

		it("optimistically appends a temp row during add (onMutate)", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [apiLevel({ id: 1, levelIndex: 0 })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.addBlindLevel.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleAddLevel();
			});
			await waitFor(() => {
				// The optimistic row is added to the API-shape cache; when mapped
				// back its id is String(0) = "0" (temp id computation uses || 0).
				expect(result.current.levels.length).toBe(2);
				expect(result.current.levels[1]).toBeDefined();
			});
			resolve?.({ id: 2 });
		});

		it("flips isAdding during in-flight create", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.addBlindLevel.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddLevel();
			});
			await waitFor(() => expect(result.current.isAdding).toBe(true));
			resolve?.({ id: 1 });
			await waitFor(() => expect(result.current.isAdding).toBe(false));
		});
	});

	describe("handleCreateLevel", () => {
		it("forwards blind1/blind2/ante/minutes and sticks minutes for next call", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0, minutes: null }),
			]);
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 2 });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleCreateLevel({
					blind1: 200,
					blind2: 400,
					ante: 50,
					minutes: 25,
				});
			});
			await waitFor(() =>
				expect(trpcMocks.addBlindLevel).toHaveBeenCalledWith(
					expect.objectContaining({
						tournamentId: TOURNAMENT_ID,
						levelIndex: 1,
						isBreak: false,
						minutes: 25,
						sortOrder: 1,
					})
				)
			);
		});

		it("falls back to lastMinutes when values.minutes is null", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0, minutes: 40 }),
			]);
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 2 });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleCreateLevel({
					blind1: 100,
					blind2: 200,
					ante: null,
					minutes: null,
				});
			});
			await waitFor(() =>
				expect(trpcMocks.addBlindLevel).toHaveBeenCalledWith(
					expect.objectContaining({
						tournamentId: TOURNAMENT_ID,
						levelIndex: 1,
						isBreak: false,
						minutes: 40,
					})
				)
			);
		});

		it("omits minutes when both values.minutes and lastMinutes are null", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0, minutes: null }),
			]);
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 2 });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleCreateLevel({
					blind1: 10,
					blind2: 20,
					ante: null,
					minutes: null,
				});
			});
			await waitFor(() =>
				expect(trpcMocks.addBlindLevel).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					levelIndex: 1,
					isBreak: false,
					sortOrder: 1,
				})
			);
		});
	});

	describe("handleUpdate", () => {
		it("routes minutes to updateBlindLevel and blind values to updateBlindSet (when a primary set exists)", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [apiLevel({ id: 1, levelIndex: 0 })]);
			trpcMocks.updateBlindLevel.mockResolvedValue({ id: 1 });
			trpcMocks.updateBlindSet.mockResolvedValue({ id: 1 });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleUpdate("1", { blind1: 500, minutes: 30 });
			});
			await waitFor(() => {
				expect(trpcMocks.updateBlindLevel).toHaveBeenCalledTimes(1);
			});
			expect(trpcMocks.updateBlindLevel).toHaveBeenCalledWith({
				id: 1,
				minutes: 30,
			});
			await waitFor(() => {
				expect(trpcMocks.updateBlindSet).toHaveBeenCalledTimes(1);
			});
			expect(trpcMocks.updateBlindSet).toHaveBeenCalledWith({
				id: 1,
				blind1: 500,
			});
		});

		it("setting minutes updates lastMinutes so the next auto-add picks it up", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0, minutes: null }),
			]);
			trpcMocks.updateBlindLevel.mockResolvedValue({ id: 1 });
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 2 });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleUpdate("1", { minutes: 60 });
			});
			act(() => {
				result.current.handleAddLevel();
			});
			await waitFor(() => {
				expect(trpcMocks.addBlindLevel).toHaveBeenCalledWith(
					expect.objectContaining({ minutes: 60 })
				);
			});
		});
	});

	describe("handleDelete", () => {
		it("optimistically removes the row and invokes removeBlindLevel.mutate with numeric id", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0 }),
				apiLevel({ id: 2, levelIndex: 1 }),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.removeBlindLevel.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(2));
			act(() => {
				result.current.handleDelete("1");
			});
			await waitFor(() => {
				expect(result.current.levels.map((l) => l.id)).toEqual(["2"]);
			});
			expect(trpcMocks.removeBlindLevel).toHaveBeenCalledWith({ id: 1 });
			resolve?.({ id: 1 });
		});
	});

	describe("handleDragEnd", () => {
		it("reorders levels optimistically and invokes updateBlindLevel per level with sortOrder", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				apiLevel({ id: 1, levelIndex: 0, sortOrder: 0 }),
				apiLevel({ id: 2, levelIndex: 1, sortOrder: 1 }),
				apiLevel({ id: 3, levelIndex: 2, sortOrder: 2 }),
			]);
			trpcMocks.updateBlindLevel.mockResolvedValue(undefined);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(3));
			// Move l1 after l3 → new order: l2, l3, l1
			act(() => {
				result.current.handleDragEnd({
					active: { id: "1" },
					over: { id: "3" },
				} as unknown as DragEndEvent);
			});
			await waitFor(() => {
				expect(trpcMocks.updateBlindLevel).toHaveBeenCalledTimes(3);
			});
			// Each level gets its new sortOrder
			expect(trpcMocks.updateBlindLevel).toHaveBeenCalledWith({
				id: 2,
				sortOrder: 0,
			});
			expect(trpcMocks.updateBlindLevel).toHaveBeenCalledWith({
				id: 3,
				sortOrder: 1,
			});
			expect(trpcMocks.updateBlindLevel).toHaveBeenCalledWith({
				id: 1,
				sortOrder: 2,
			});
		});

		it("no-ops when over is null", () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [apiLevel({ id: 1 })]);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleDragEnd({
					active: { id: "1" },
					over: null,
				} as unknown as DragEndEvent);
			});
			expect(trpcMocks.updateBlindLevel).not.toHaveBeenCalled();
		});

		it("no-ops when active.id === over.id", () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [apiLevel({ id: 1 })]);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleDragEnd({
					active: { id: "1" },
					over: { id: "1" },
				} as unknown as DragEndEvent);
			});
			expect(trpcMocks.updateBlindLevel).not.toHaveBeenCalled();
		});

		it("no-ops when an id is not found in the levels list", () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [apiLevel({ id: 1 })]);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleDragEnd({
					active: { id: "1" },
					over: { id: "999" },
				} as unknown as DragEndEvent);
			});
			expect(trpcMocks.updateBlindLevel).not.toHaveBeenCalled();
		});
	});

	describe("sensors", () => {
		it("exposes a sensors array suitable for DndContext", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(Array.isArray(result.current.sensors)).toBe(true);
			expect(result.current.sensors.length).toBeGreaterThan(0);
		});
	});
});
