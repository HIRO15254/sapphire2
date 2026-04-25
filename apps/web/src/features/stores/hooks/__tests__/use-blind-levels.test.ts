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
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	reorder: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		blindLevel: {
			listByTournament: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("blindLevel", "listByTournament", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		blindLevel: {
			create: { mutate: trpcMocks.create },
			update: { mutate: trpcMocks.update },
			delete: { mutate: trpcMocks.delete },
			reorder: { mutate: trpcMocks.reorder },
		},
	},
}));

import {
	type BlindLevelRow,
	useBlindLevels,
} from "@/features/stores/hooks/use-blind-levels";

const TOURNAMENT_ID = "tour-1";
const LEVELS_KEY = [
	"blindLevel",
	"listByTournament",
	{ tournamentId: TOURNAMENT_ID },
];

function level(overrides: Partial<BlindLevelRow> = {}): BlindLevelRow {
	return {
		id: "l1",
		tournamentId: TOURNAMENT_ID,
		level: 1,
		isBreak: false,
		blind1: 100,
		blind2: 200,
		blind3: null,
		ante: 25,
		minutes: 20,
		...overrides,
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

		it("exposes seeded levels from the cache", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ id: "l1" }), level({ id: "l2" })]);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(2));
		});
	});

	describe("handleAddLevel / handleAddBreak", () => {
		it("sends { level: n+1, isBreak: false, minutes: lastNonNull } when last-minutes exists", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				level({ id: "l1", minutes: 20 }),
				level({ id: "l2", minutes: null }),
			]);
			trpcMocks.create.mockResolvedValue({ id: "new" });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(2));
			act(() => {
				result.current.handleAddLevel();
			});
			await waitFor(() =>
				expect(trpcMocks.create).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					level: 3,
					isBreak: false,
					minutes: 20,
				})
			);
		});

		it("omits minutes when no level has a minutes value", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ minutes: null })]);
			trpcMocks.create.mockResolvedValue({ id: "new" });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleAddLevel();
			});
			await waitFor(() =>
				expect(trpcMocks.create).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					level: 2,
					isBreak: false,
				})
			);
		});

		it("handleAddBreak sends isBreak=true", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ minutes: 15 })]);
			trpcMocks.create.mockResolvedValue({ id: "break" });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleAddBreak();
			});
			await waitFor(() =>
				expect(trpcMocks.create).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					level: 2,
					isBreak: true,
					minutes: 15,
				})
			);
		});

		it("optimistically appends a temp row during add (onMutate)", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ id: "l1" })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
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
				const list = qc.getQueryData<BlindLevelRow[]>(LEVELS_KEY);
				expect(list?.length).toBe(2);
				expect(list?.[1]?.id.startsWith("temp-")).toBe(true);
			});
			resolve?.({ id: "real" });
		});

		it("flips isAdding during in-flight create", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
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
			resolve?.({ id: "x" });
			await waitFor(() => expect(result.current.isAdding).toBe(false));
		});
	});

	describe("handleCreateLevel", () => {
		it("forwards blind1/blind2/ante/minutes verbatim and sticks minutes for next call", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ minutes: null })]);
			trpcMocks.create.mockResolvedValue({ id: "ok" });
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
				expect(trpcMocks.create).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					level: 2,
					isBreak: false,
					blind1: 200,
					blind2: 400,
					ante: 50,
					minutes: 25,
				})
			);
		});

		it("falls back to lastMinutes when values.minutes is null (ante key omitted when null)", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ minutes: 40 })]);
			trpcMocks.create.mockResolvedValue({ id: "ok" });
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
				expect(trpcMocks.create).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					level: 2,
					isBreak: false,
					blind1: 100,
					blind2: 200,
					minutes: 40,
				})
			);
		});

		it("omits minutes and ante keys when both are null and no lastMinutes", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ minutes: null })]);
			trpcMocks.create.mockResolvedValue({ id: "ok" });
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
				expect(trpcMocks.create).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					level: 2,
					isBreak: false,
					blind1: 10,
					blind2: 20,
				})
			);
		});
	});

	describe("handleUpdate", () => {
		it("optimistically patches the row in cache and fires one mutate per field", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ id: "l1", blind1: 100 })]);
			trpcMocks.update.mockResolvedValue({ id: "l1" });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));
			act(() => {
				result.current.handleUpdate("l1", { blind1: 500, minutes: 30 });
			});
			const list = qc.getQueryData<BlindLevelRow[]>(LEVELS_KEY);
			expect(list?.[0]?.blind1).toBe(500);
			expect(list?.[0]?.minutes).toBe(30);
			await waitFor(() => {
				expect(trpcMocks.update).toHaveBeenCalledTimes(2);
			});
			expect(trpcMocks.update).toHaveBeenCalledWith({
				id: "l1",
				blind1: 500,
			});
			expect(trpcMocks.update).toHaveBeenCalledWith({
				id: "l1",
				minutes: 30,
			});
		});

		it("setting minutes updates lastMinutes so the next auto-add picks it up", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ id: "l1", minutes: null })]);
			trpcMocks.update.mockResolvedValue({ id: "l1" });
			trpcMocks.create.mockResolvedValue({ id: "new" });
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(1));

			act(() => {
				result.current.handleUpdate("l1", { minutes: 60 });
			});
			act(() => {
				result.current.handleAddLevel();
			});
			await waitFor(() => {
				expect(trpcMocks.create).toHaveBeenCalledWith(
					expect.objectContaining({ minutes: 60 })
				);
			});
		});
	});

	describe("handleDelete", () => {
		it("optimistically removes the row and invokes delete.mutate", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ id: "l1" }), level({ id: "l2" })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.delete.mockImplementation(
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
				result.current.handleDelete("l1");
			});
			await waitFor(() => {
				const list = qc.getQueryData<BlindLevelRow[]>(LEVELS_KEY);
				expect(list?.map((l) => l.id)).toEqual(["l2"]);
			});
			expect(trpcMocks.delete).toHaveBeenCalledWith({ id: "l1" });
			resolve?.({ id: "l1" });
		});
	});

	describe("handleDragEnd", () => {
		it("reorders levels optimistically and invokes reorder mutation with the new id order", async () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [
				level({ id: "l1" }),
				level({ id: "l2", level: 2 }),
				level({ id: "l3", level: 3 }),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.reorder.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.levels).toHaveLength(3));
			// Move l1 after l3 → new order l2, l3, l1
			act(() => {
				result.current.handleDragEnd({
					active: { id: "l1" },
					over: { id: "l3" },
				} as unknown as DragEndEvent);
			});
			await waitFor(() =>
				expect(trpcMocks.reorder).toHaveBeenCalledWith({
					tournamentId: TOURNAMENT_ID,
					levelIds: ["l2", "l3", "l1"],
				})
			);
			const list = qc.getQueryData<BlindLevelRow[]>(LEVELS_KEY);
			expect(list?.map((l) => l.id)).toEqual(["l2", "l3", "l1"]);
			resolve?.(undefined);
		});

		it("no-ops when over is null", () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ id: "l1" })]);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleDragEnd({
					active: { id: "l1" },
					over: null,
				} as unknown as DragEndEvent);
			});
			expect(trpcMocks.reorder).not.toHaveBeenCalled();
		});

		it("no-ops when active.id === over.id", () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ id: "l1" })]);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleDragEnd({
					active: { id: "l1" },
					over: { id: "l1" },
				} as unknown as DragEndEvent);
			});
			expect(trpcMocks.reorder).not.toHaveBeenCalled();
		});

		it("no-ops when an id is not found in the levels list", () => {
			const qc = createClient();
			qc.setQueryData(LEVELS_KEY, [level({ id: "l1" })]);
			const { result } = renderHook(
				() => useBlindLevels({ tournamentId: TOURNAMENT_ID }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleDragEnd({
					active: { id: "l1" },
					over: { id: "unknown" },
				} as unknown as DragEndEvent);
			});
			expect(trpcMocks.reorder).not.toHaveBeenCalled();
		});
	});

	describe("sensors", () => {
		it("exposes a sensors object suitable for DndContext", () => {
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
