import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const SESSION_QUERY_KEY = ["liveSession.getById", "sess-1"];
const LIMIT_FORMAT_KEY = ["limitFormat.list"];

const trpcMocks = vi.hoisted(() => ({
	addBlindSet: vi.fn(),
	updateBlindSet: vi.fn(),
	removeBlindSet: vi.fn(),
	addBlindLevel: vi.fn(),
	updateBlindLevel: vi.fn(),
	removeBlindLevel: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		limitFormat: {
			list: {
				queryOptions: () => ({
					queryKey: LIMIT_FORMAT_KEY,
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		liveSession: {
			getById: {
				queryOptions: (input: { id: string }) => ({
					queryKey: ["liveSession.getById", input.id],
				}),
			},
		},
	},
	trpcClient: {
		liveSession: {
			addBlindSet: { mutate: trpcMocks.addBlindSet },
			updateBlindSet: { mutate: trpcMocks.updateBlindSet },
			removeBlindSet: { mutate: trpcMocks.removeBlindSet },
			addBlindLevel: { mutate: trpcMocks.addBlindLevel },
			updateBlindLevel: { mutate: trpcMocks.updateBlindLevel },
			removeBlindLevel: { mutate: trpcMocks.removeBlindLevel },
		},
	},
}));

import type {
	BlindLevel,
	BlindSet,
	LimitFormat,
} from "../use-blind-set-editor";
import { useBlindSetEditor } from "../use-blind-set-editor";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LIMIT_FORMAT_A: LimitFormat = {
	id: 1,
	name: "NLHE",
	blind1Label: "SB",
	blind2Label: "BB",
	blind3Label: null,
	blind4Label: null,
};

const BLIND_SET_1: BlindSet = {
	id: 10,
	limitFormatId: 1,
	blind1: 100,
	blind2: 200,
	blind3: null,
	blind4: null,
	ante: null,
	anteType: null,
	sortOrder: 0,
};

const BLIND_LEVEL_1: BlindLevel = {
	id: 5,
	levelIndex: 1,
	isBreak: false,
	minutes: 20,
	sortOrder: 0,
	blindSets: [BLIND_SET_1],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createClient(limitFormats: LimitFormat[] = []): QueryClient {
	const qc = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
	qc.setQueryData(LIMIT_FORMAT_KEY, limitFormats);
	qc.setQueryData(SESSION_QUERY_KEY, {});
	return qc;
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

interface RenderOptions {
	blindLevels?: BlindLevel[];
	cashBlindSets?: BlindSet[];
	isReadOnly?: boolean;
	kind?: "cash_game" | "tournament";
	limitFormats?: LimitFormat[];
}

function renderEditor({
	kind = "cash_game",
	blindLevels = [],
	cashBlindSets = [],
	isReadOnly = false,
	limitFormats = [LIMIT_FORMAT_A],
}: RenderOptions = {}) {
	const qc = createClient(limitFormats);
	const utils = renderHook(
		() =>
			useBlindSetEditor({
				sessionId: "sess-1",
				kind,
				blindLevels,
				cashBlindSets,
				isReadOnly,
			}),
		{ wrapper: makeWrapper(qc) }
	);
	return { ...utils, qc };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useBlindSetEditor", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns the provided kind and isReadOnly", () => {
			const { result } = renderEditor({ kind: "tournament", isReadOnly: true });
			expect(result.current.kind).toBe("tournament");
			expect(result.current.isReadOnly).toBe(true);
		});

		it("returns empty cash blind sets by default", () => {
			const { result } = renderEditor({ kind: "cash_game" });
			expect(result.current.cashBlindSets).toEqual([]);
		});

		it("returns provided blind levels for tournament mode", () => {
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [BLIND_LEVEL_1],
			});
			expect(result.current.blindLevels).toEqual([BLIND_LEVEL_1]);
		});

		it("starts with null addBlindSetTarget", () => {
			const { result } = renderEditor();
			expect(result.current.addBlindSetTarget).toBeNull();
		});

		it("starts with null editingBlindSetId", () => {
			const { result } = renderEditor();
			expect(result.current.editingBlindSetId).toBeNull();
		});

		it("starts with add level dialog closed", () => {
			const { result } = renderEditor({ kind: "tournament" });
			expect(result.current.isAddLevelOpen).toBe(false);
		});

		it("all pending flags start false", () => {
			const { result } = renderEditor();
			expect(result.current.isAddBlindSetPending).toBe(false);
			expect(result.current.isUpdateBlindSetPending).toBe(false);
			expect(result.current.isRemoveBlindSetPending).toBe(false);
			expect(result.current.isAddLevelPending).toBe(false);
			expect(result.current.isUpdateLevelPending).toBe(false);
			expect(result.current.isRemoveLevelPending).toBe(false);
		});

		it("exposes limit formats from query cache", async () => {
			const { result } = renderEditor({ limitFormats: [LIMIT_FORMAT_A] });
			await waitFor(() => expect(result.current.limitFormats).toHaveLength(1));
			expect(result.current.limitFormats[0]?.name).toBe("NLHE");
		});

		it("returns empty limit formats when cache is empty", async () => {
			const { result } = renderEditor({ limitFormats: [] });
			await waitFor(() => expect(result.current.limitFormats).toHaveLength(0));
		});
	});

	describe("setAddBlindSetTarget", () => {
		it("opens add form for cash mode with 'cash' target", () => {
			const { result } = renderEditor({ kind: "cash_game" });
			act(() => {
				result.current.setAddBlindSetTarget("cash");
			});
			expect(result.current.addBlindSetTarget).toBe("cash");
		});

		it("opens add form for tournament mode with level id target", () => {
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [BLIND_LEVEL_1],
			});
			act(() => {
				result.current.setAddBlindSetTarget(BLIND_LEVEL_1.id);
			});
			expect(result.current.addBlindSetTarget).toBe(BLIND_LEVEL_1.id);
		});

		it("clears target when set to null", () => {
			const { result } = renderEditor();
			act(() => {
				result.current.setAddBlindSetTarget("cash");
			});
			act(() => {
				result.current.setAddBlindSetTarget(null);
			});
			expect(result.current.addBlindSetTarget).toBeNull();
		});
	});

	describe("openEditBlindSet / closeEditBlindSet", () => {
		it("sets editingBlindSetId with id and type", () => {
			const { result } = renderEditor();
			act(() => {
				result.current.openEditBlindSet(BLIND_SET_1, "cash");
			});
			expect(result.current.editingBlindSetId).toEqual({
				id: BLIND_SET_1.id,
				type: "cash",
			});
		});

		it("clears editingBlindSetId on closeEditBlindSet", () => {
			const { result } = renderEditor();
			act(() => {
				result.current.openEditBlindSet(BLIND_SET_1, "cash");
			});
			act(() => {
				result.current.closeEditBlindSet();
			});
			expect(result.current.editingBlindSetId).toBeNull();
		});

		it("opens edit for tournament type", () => {
			const { result } = renderEditor({ kind: "tournament" });
			act(() => {
				result.current.openEditBlindSet(BLIND_SET_1, "tournament");
			});
			expect(result.current.editingBlindSetId).toEqual({
				id: BLIND_SET_1.id,
				type: "tournament",
			});
		});
	});

	describe("add blind set mutation (cash)", () => {
		it("calls addBlindSet with cash type when target is 'cash'", async () => {
			trpcMocks.addBlindSet.mockResolvedValue({ id: 20 });
			const { result } = renderEditor({ kind: "cash_game" });

			act(() => {
				result.current.setAddBlindSetTarget("cash");
				result.current.addBlindSetForm.setFieldValue("limitFormatId", "1");
				result.current.addBlindSetForm.setFieldValue("blind1", "100");
				result.current.addBlindSetForm.setFieldValue("blind2", "200");
			});
			await act(async () => {
				await result.current.addBlindSetForm.handleSubmit();
			});
			await waitFor(() => {
				expect(trpcMocks.addBlindSet).toHaveBeenCalledWith(
					expect.objectContaining({
						sessionId: "sess-1",
						limitFormatId: 1,
						blind1: 100,
						blind2: 200,
					})
				);
			});
		});

		it("resets addBlindSetTarget to null on successful add", async () => {
			trpcMocks.addBlindSet.mockResolvedValue({ id: 21 });
			const { result } = renderEditor({ kind: "cash_game" });

			act(() => {
				result.current.setAddBlindSetTarget("cash");
				result.current.addBlindSetForm.setFieldValue("limitFormatId", "1");
				result.current.addBlindSetForm.setFieldValue("blind1", "50");
				result.current.addBlindSetForm.setFieldValue("blind2", "100");
			});
			await act(async () => {
				await result.current.addBlindSetForm.handleSubmit();
			});
			await waitFor(() => {
				expect(result.current.addBlindSetTarget).toBeNull();
			});
		});

		it("isAddBlindSetPending is true during in-flight add", async () => {
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.addBlindSet.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderEditor({ kind: "cash_game" });

			act(() => {
				result.current.setAddBlindSetTarget("cash");
				result.current.addBlindSetForm.setFieldValue("limitFormatId", "1");
				result.current.addBlindSetForm.setFieldValue("blind1", "25");
				result.current.addBlindSetForm.setFieldValue("blind2", "50");
				result.current.addBlindSetForm.handleSubmit();
			});
			await waitFor(() =>
				expect(result.current.isAddBlindSetPending).toBe(true)
			);
			resolve?.({ id: 30 });
			await waitFor(() =>
				expect(result.current.isAddBlindSetPending).toBe(false)
			);
		});
	});

	describe("add blind set mutation (tournament)", () => {
		it("calls addBlindSet with sessionBlindLevelId when target is level id", async () => {
			trpcMocks.addBlindSet.mockResolvedValue({ id: 25 });
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [BLIND_LEVEL_1],
			});

			act(() => {
				result.current.setAddBlindSetTarget(BLIND_LEVEL_1.id);
				result.current.addBlindSetForm.setFieldValue("limitFormatId", "1");
				result.current.addBlindSetForm.setFieldValue("blind1", "500");
				result.current.addBlindSetForm.setFieldValue("blind2", "1000");
			});
			await act(async () => {
				await result.current.addBlindSetForm.handleSubmit();
			});
			await waitFor(() => {
				expect(trpcMocks.addBlindSet).toHaveBeenCalledWith(
					expect.objectContaining({
						sessionBlindLevelId: BLIND_LEVEL_1.id,
						limitFormatId: 1,
						blind1: 500,
						blind2: 1000,
					})
				);
			});
		});
	});

	describe("remove blind set (onRemoveBlindSet)", () => {
		it("calls removeBlindSet with cash type", async () => {
			trpcMocks.removeBlindSet.mockResolvedValue({});
			const { result } = renderEditor({
				kind: "cash_game",
				cashBlindSets: [BLIND_SET_1],
			});
			act(() => {
				result.current.onRemoveBlindSet(BLIND_SET_1.id, "cash");
			});
			await waitFor(() => {
				expect(trpcMocks.removeBlindSet).toHaveBeenCalledTimes(1);
				expect(trpcMocks.removeBlindSet).toHaveBeenCalledWith({
					type: "cash",
					id: BLIND_SET_1.id,
				});
			});
		});

		it("calls removeBlindSet with tournament type", async () => {
			trpcMocks.removeBlindSet.mockResolvedValue({});
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [BLIND_LEVEL_1],
			});
			act(() => {
				result.current.onRemoveBlindSet(BLIND_SET_1.id, "tournament");
			});
			await waitFor(() => {
				expect(trpcMocks.removeBlindSet).toHaveBeenCalledWith({
					type: "tournament",
					id: BLIND_SET_1.id,
				});
			});
		});

		it("isRemoveBlindSetPending is true during in-flight remove", async () => {
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.removeBlindSet.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderEditor({
				kind: "cash_game",
				cashBlindSets: [BLIND_SET_1],
			});
			act(() => {
				result.current.onRemoveBlindSet(BLIND_SET_1.id, "cash");
			});
			await waitFor(() =>
				expect(result.current.isRemoveBlindSetPending).toBe(true)
			);
			resolve?.({});
			await waitFor(() =>
				expect(result.current.isRemoveBlindSetPending).toBe(false)
			);
		});
	});

	describe("add blind level mutation (tournament only)", () => {
		it("calls addBlindLevel with correct values", async () => {
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 6 });
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [],
			});

			act(() => {
				result.current.setIsAddLevelOpen(true);
				result.current.addLevelForm.setFieldValue("levelIndex", "1");
				result.current.addLevelForm.setFieldValue("isBreak", false);
				result.current.addLevelForm.setFieldValue("minutes", "20");
			});
			await act(async () => {
				await result.current.addLevelForm.handleSubmit();
			});
			await waitFor(() => {
				expect(trpcMocks.addBlindLevel).toHaveBeenCalledWith(
					expect.objectContaining({
						sessionId: "sess-1",
						levelIndex: 1,
						isBreak: false,
						minutes: 20,
					})
				);
			});
		});

		it("closes add level dialog on successful add", async () => {
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 7 });
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [],
			});

			act(() => {
				result.current.setIsAddLevelOpen(true);
				result.current.addLevelForm.setFieldValue("levelIndex", "1");
				result.current.addLevelForm.setFieldValue("isBreak", false);
				result.current.addLevelForm.setFieldValue("minutes", "20");
			});
			await act(async () => {
				await result.current.addLevelForm.handleSubmit();
			});
			await waitFor(() => {
				expect(result.current.isAddLevelOpen).toBe(false);
			});
		});

		it("isAddLevelPending is true during in-flight add level", async () => {
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.addBlindLevel.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [],
			});

			act(() => {
				result.current.addLevelForm.setFieldValue("levelIndex", "1");
				result.current.addLevelForm.setFieldValue("isBreak", false);
				result.current.addLevelForm.setFieldValue("minutes", "20");
				result.current.addLevelForm.handleSubmit();
			});
			await waitFor(() => expect(result.current.isAddLevelPending).toBe(true));
			resolve?.({ id: 8 });
			await waitFor(() => expect(result.current.isAddLevelPending).toBe(false));
		});
	});

	describe("remove blind level (onRemoveLevel)", () => {
		it("calls removeBlindLevel with correct id", async () => {
			trpcMocks.removeBlindLevel.mockResolvedValue({});
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [BLIND_LEVEL_1],
			});
			act(() => {
				result.current.onRemoveLevel(BLIND_LEVEL_1.id);
			});
			await waitFor(() => {
				expect(trpcMocks.removeBlindLevel).toHaveBeenCalledTimes(1);
				expect(trpcMocks.removeBlindLevel).toHaveBeenCalledWith({
					id: BLIND_LEVEL_1.id,
				});
			});
		});

		it("isRemoveLevelPending is true during in-flight remove", async () => {
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.removeBlindLevel.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [BLIND_LEVEL_1],
			});
			act(() => {
				result.current.onRemoveLevel(BLIND_LEVEL_1.id);
			});
			await waitFor(() =>
				expect(result.current.isRemoveLevelPending).toBe(true)
			);
			resolve?.({});
			await waitFor(() =>
				expect(result.current.isRemoveLevelPending).toBe(false)
			);
		});
	});

	describe("openEditLevel / closeEditLevel", () => {
		it("sets editingLevelId on openEditLevel", () => {
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [BLIND_LEVEL_1],
			});
			act(() => {
				result.current.openEditLevel(BLIND_LEVEL_1);
			});
			expect(result.current.editingLevelId).toBe(BLIND_LEVEL_1.id);
		});

		it("clears editingLevelId on closeEditLevel", () => {
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [BLIND_LEVEL_1],
			});
			act(() => {
				result.current.openEditLevel(BLIND_LEVEL_1);
			});
			act(() => {
				result.current.closeEditLevel();
			});
			expect(result.current.editingLevelId).toBeNull();
		});
	});

	describe("query invalidation", () => {
		it("invalidates liveSession.getById after successful addBlindSet", async () => {
			trpcMocks.addBlindSet.mockResolvedValue({ id: 99 });
			const { result, qc } = renderEditor({ kind: "cash_game" });
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

			act(() => {
				result.current.setAddBlindSetTarget("cash");
				result.current.addBlindSetForm.setFieldValue("limitFormatId", "1");
				result.current.addBlindSetForm.setFieldValue("blind1", "10");
				result.current.addBlindSetForm.setFieldValue("blind2", "20");
			});
			await act(async () => {
				await result.current.addBlindSetForm.handleSubmit();
			});
			await waitFor(() => {
				expect(invalidateSpy).toHaveBeenCalled();
			});
			const firstCall = invalidateSpy.mock.calls[0]?.[0] as
				| { queryKey?: unknown }
				| undefined;
			expect(firstCall?.queryKey).toEqual(SESSION_QUERY_KEY);
		});

		it("invalidates liveSession.getById after successful removeBlindSet", async () => {
			trpcMocks.removeBlindSet.mockResolvedValue({});
			const { result, qc } = renderEditor({
				kind: "cash_game",
				cashBlindSets: [BLIND_SET_1],
			});
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

			act(() => {
				result.current.onRemoveBlindSet(BLIND_SET_1.id, "cash");
			});
			await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
			const firstCall = invalidateSpy.mock.calls[0]?.[0] as
				| { queryKey?: unknown }
				| undefined;
			expect(firstCall?.queryKey).toEqual(SESSION_QUERY_KEY);
		});

		it("invalidates liveSession.getById after successful addBlindLevel", async () => {
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 50 });
			const { result, qc } = renderEditor({
				kind: "tournament",
				blindLevels: [],
			});
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

			act(() => {
				result.current.addLevelForm.setFieldValue("levelIndex", "1");
				result.current.addLevelForm.setFieldValue("isBreak", false);
				result.current.addLevelForm.setFieldValue("minutes", "20");
			});
			await act(async () => {
				await result.current.addLevelForm.handleSubmit();
			});
			await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
			const firstCall = invalidateSpy.mock.calls[0]?.[0] as
				| { queryKey?: unknown }
				| undefined;
			expect(firstCall?.queryKey).toEqual(SESSION_QUERY_KEY);
		});
	});

	describe("setIsAddLevelOpen", () => {
		it("opens the add level dialog", () => {
			const { result } = renderEditor({ kind: "tournament" });
			act(() => {
				result.current.setIsAddLevelOpen(true);
			});
			expect(result.current.isAddLevelOpen).toBe(true);
		});

		it("closes the add level dialog", () => {
			const { result } = renderEditor({ kind: "tournament" });
			act(() => {
				result.current.setIsAddLevelOpen(true);
			});
			act(() => {
				result.current.setIsAddLevelOpen(false);
			});
			expect(result.current.isAddLevelOpen).toBe(false);
		});
	});

	describe("addLevelForm — break level with no minutes", () => {
		it("submits a break level with minutes undefined when field is empty", async () => {
			trpcMocks.addBlindLevel.mockResolvedValue({ id: 9 });
			const { result } = renderEditor({
				kind: "tournament",
				blindLevels: [],
			});

			act(() => {
				result.current.addLevelForm.setFieldValue("levelIndex", "2");
				result.current.addLevelForm.setFieldValue("isBreak", true);
				result.current.addLevelForm.setFieldValue("minutes", "");
			});
			await act(async () => {
				await result.current.addLevelForm.handleSubmit();
			});
			await waitFor(() => {
				expect(trpcMocks.addBlindLevel).toHaveBeenCalledWith(
					expect.objectContaining({
						levelIndex: 2,
						isBreak: true,
						minutes: undefined,
					})
				);
			});
		});
	});
});
