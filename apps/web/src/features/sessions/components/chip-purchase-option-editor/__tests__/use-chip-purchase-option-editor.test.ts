import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const SESSION_QUERY_KEY = ["liveSession.getById", "session-1"];

const trpcMocks = vi.hoisted(() => ({
	addChipPurchaseOption: vi.fn(),
	updateChipPurchaseOption: vi.fn(),
	removeChipPurchaseOption: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
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
			addChipPurchaseOption: { mutate: trpcMocks.addChipPurchaseOption },
			updateChipPurchaseOption: { mutate: trpcMocks.updateChipPurchaseOption },
			removeChipPurchaseOption: { mutate: trpcMocks.removeChipPurchaseOption },
		},
	},
}));

import type { ChipPurchaseOption } from "../use-chip-purchase-option-editor";
import { useChipPurchaseOptionEditor } from "../use-chip-purchase-option-editor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPTION_A: ChipPurchaseOption = {
	id: 1,
	name: "Rebuy",
	cost: 10_000,
	chips: 50_000,
	sortOrder: 0,
};

const OPTION_B: ChipPurchaseOption = {
	id: 2,
	name: "Add-on",
	cost: 20_000,
	chips: 100_000,
	sortOrder: 1,
};

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

function renderEditor(
	options: ChipPurchaseOption[] = [],
	isReadOnly = false,
	qc?: QueryClient
) {
	const client = qc ?? createClient();
	const utils = renderHook(
		() =>
			useChipPurchaseOptionEditor({
				sessionId: "session-1",
				options,
				isReadOnly,
			}),
		{ wrapper: makeWrapper(client) }
	);
	return { ...utils, client };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useChipPurchaseOptionEditor", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns provided options and isReadOnly flag", () => {
			const { result } = renderEditor([OPTION_A, OPTION_B], false);
			expect(result.current.options).toEqual([OPTION_A, OPTION_B]);
			expect(result.current.isReadOnly).toBe(false);
		});

		it("starts with no editing id and add sheet closed", () => {
			const { result } = renderEditor();
			expect(result.current.editingId).toBeNull();
			expect(result.current.isAddOpen).toBe(false);
		});

		it("all pending flags start as false", () => {
			const { result } = renderEditor();
			expect(result.current.isAddPending).toBe(false);
			expect(result.current.isUpdatePending).toBe(false);
			expect(result.current.isRemovePending).toBe(false);
		});

		it("passes through isReadOnly=true", () => {
			const { result } = renderEditor([], true);
			expect(result.current.isReadOnly).toBe(true);
		});

		it("returns empty options when options array is empty", () => {
			const { result } = renderEditor([]);
			expect(result.current.options).toEqual([]);
		});
	});

	describe("add sheet toggle", () => {
		it("opens add sheet via setIsAddOpen(true)", () => {
			const { result } = renderEditor();
			act(() => {
				result.current.setIsAddOpen(true);
			});
			expect(result.current.isAddOpen).toBe(true);
		});

		it("closes add sheet via setIsAddOpen(false)", () => {
			const { result } = renderEditor();
			act(() => {
				result.current.setIsAddOpen(true);
			});
			act(() => {
				result.current.setIsAddOpen(false);
			});
			expect(result.current.isAddOpen).toBe(false);
		});
	});

	describe("openEdit / closeEdit", () => {
		it("sets editingId when openEdit is called", () => {
			const { result } = renderEditor([OPTION_A]);
			act(() => {
				result.current.openEdit(OPTION_A);
			});
			expect(result.current.editingId).toBe(OPTION_A.id);
		});

		it("clears editingId on closeEdit", () => {
			const { result } = renderEditor([OPTION_A]);
			act(() => {
				result.current.openEdit(OPTION_A);
			});
			act(() => {
				result.current.closeEdit();
			});
			expect(result.current.editingId).toBeNull();
		});

		it("updates editingId when switching to a different option", () => {
			const { result } = renderEditor([OPTION_A, OPTION_B]);
			act(() => {
				result.current.openEdit(OPTION_A);
			});
			act(() => {
				result.current.openEdit(OPTION_B);
			});
			expect(result.current.editingId).toBe(OPTION_B.id);
		});
	});

	describe("add mutation", () => {
		it("calls addChipPurchaseOption with correct values and closes add sheet on success", async () => {
			trpcMocks.addChipPurchaseOption.mockResolvedValue({ id: 10 });
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});

			const { result } = renderEditor([OPTION_A], false, qc);
			act(() => {
				result.current.setIsAddOpen(true);
				result.current.addForm.setFieldValue("name", "Side Bet");
				result.current.addForm.setFieldValue("cost", "5000");
				result.current.addForm.setFieldValue("chips", "25000");
			});
			await act(async () => {
				await result.current.addForm.handleSubmit();
			});
			await waitFor(() => {
				expect(trpcMocks.addChipPurchaseOption).toHaveBeenCalledWith({
					sessionId: "session-1",
					name: "Side Bet",
					cost: 5000,
					chips: 25_000,
					sortOrder: 1,
				});
			});
			await waitFor(() => {
				expect(result.current.isAddOpen).toBe(false);
			});
		});

		it("isAddPending is true during in-flight add mutation", async () => {
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.addChipPurchaseOption.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});

			const { result } = renderEditor([], false, qc);
			act(() => {
				result.current.addForm.setFieldValue("name", "X");
				result.current.addForm.setFieldValue("cost", "1000");
				result.current.addForm.setFieldValue("chips", "2000");
				result.current.addForm.handleSubmit();
			});
			await waitFor(() => expect(result.current.isAddPending).toBe(true));
			resolve?.({ id: 99 });
			await waitFor(() => expect(result.current.isAddPending).toBe(false));
		});

		it("uses sortOrder form field when provided", async () => {
			trpcMocks.addChipPurchaseOption.mockResolvedValue({ id: 11 });
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});

			const { result } = renderEditor([], false, qc);
			act(() => {
				result.current.addForm.setFieldValue("name", "Late Reg");
				result.current.addForm.setFieldValue("cost", "3000");
				result.current.addForm.setFieldValue("chips", "15000");
				result.current.addForm.setFieldValue("sortOrder", "5");
			});
			await act(async () => {
				await result.current.addForm.handleSubmit();
			});
			await waitFor(() => {
				expect(trpcMocks.addChipPurchaseOption).toHaveBeenCalledWith(
					expect.objectContaining({ sortOrder: 5 })
				);
			});
		});
	});

	describe("update mutation", () => {
		it("calls updateChipPurchaseOption with editingId and form values", async () => {
			trpcMocks.updateChipPurchaseOption.mockResolvedValue({ id: 1 });
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});

			const { result } = renderEditor([OPTION_A], false, qc);
			act(() => {
				result.current.openEdit(OPTION_A);
			});
			act(() => {
				result.current.editForm.setFieldValue("name", "Super Rebuy");
				result.current.editForm.setFieldValue("cost", "15000");
				result.current.editForm.setFieldValue("chips", "75000");
				result.current.editForm.setFieldValue("sortOrder", "0");
			});
			await act(async () => {
				await result.current.editForm.handleSubmit();
			});
			await waitFor(() => {
				expect(trpcMocks.updateChipPurchaseOption).toHaveBeenCalledWith({
					id: OPTION_A.id,
					name: "Super Rebuy",
					cost: 15_000,
					chips: 75_000,
					sortOrder: 0,
				});
			});
		});

		it("clears editingId on successful update", async () => {
			trpcMocks.updateChipPurchaseOption.mockResolvedValue({ id: 1 });
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});

			const { result } = renderEditor([OPTION_A], false, qc);
			act(() => {
				result.current.openEdit(OPTION_A);
				// Manually set required field values so the form passes Zod validation
				result.current.editForm.setFieldValue("name", "Rebuy");
				result.current.editForm.setFieldValue("cost", "10000");
				result.current.editForm.setFieldValue("chips", "50000");
				result.current.editForm.setFieldValue("sortOrder", "0");
			});
			await act(async () => {
				await result.current.editForm.handleSubmit();
			});
			await waitFor(() => {
				expect(result.current.editingId).toBeNull();
			});
		});

		it("does not call update when editingId is null", async () => {
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});

			const { result } = renderEditor([OPTION_A], false, qc);
			// editingId is null — submit has no effect
			await act(async () => {
				await result.current.editForm.handleSubmit();
			});
			expect(trpcMocks.updateChipPurchaseOption).not.toHaveBeenCalled();
		});
	});

	describe("remove mutation (onRemove)", () => {
		it("calls removeChipPurchaseOption with the given id", async () => {
			trpcMocks.removeChipPurchaseOption.mockResolvedValue({});
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});

			const { result } = renderEditor([OPTION_A], false, qc);
			act(() => {
				result.current.onRemove(OPTION_A.id);
			});
			await waitFor(() => {
				expect(trpcMocks.removeChipPurchaseOption).toHaveBeenCalledTimes(1);
				expect(trpcMocks.removeChipPurchaseOption).toHaveBeenCalledWith({
					id: OPTION_A.id,
				});
			});
		});

		it("isRemovePending is true during in-flight remove", async () => {
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.removeChipPurchaseOption.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});

			const { result } = renderEditor([OPTION_A], false, qc);
			act(() => {
				result.current.onRemove(OPTION_A.id);
			});
			await waitFor(() => expect(result.current.isRemovePending).toBe(true));
			resolve?.({});
			await waitFor(() => expect(result.current.isRemovePending).toBe(false));
		});
	});

	describe("query invalidation on success", () => {
		it("invalidates liveSession.getById query key after successful add", async () => {
			trpcMocks.addChipPurchaseOption.mockResolvedValue({ id: 20 });
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

			const { result } = renderEditor([], false, qc);
			act(() => {
				result.current.addForm.setFieldValue("name", "X");
				result.current.addForm.setFieldValue("cost", "100");
				result.current.addForm.setFieldValue("chips", "500");
			});
			await act(async () => {
				await result.current.addForm.handleSubmit();
			});
			await waitFor(() => {
				expect(invalidateSpy).toHaveBeenCalled();
			});
			const firstCall = invalidateSpy.mock.calls[0]?.[0] as
				| { queryKey?: unknown }
				| undefined;
			expect(firstCall?.queryKey).toEqual(SESSION_QUERY_KEY);
		});

		it("invalidates liveSession.getById query key after successful remove", async () => {
			trpcMocks.removeChipPurchaseOption.mockResolvedValue({});
			const qc = createClient();
			qc.setQueryData(SESSION_QUERY_KEY, {});
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

			const { result } = renderEditor([OPTION_A], false, qc);
			act(() => {
				result.current.onRemove(OPTION_A.id);
			});
			await waitFor(() => {
				expect(invalidateSpy).toHaveBeenCalled();
			});
			const firstCall = invalidateSpy.mock.calls[0]?.[0] as
				| { queryKey?: unknown }
				| undefined;
			expect(firstCall?.queryKey).toEqual(SESSION_QUERY_KEY);
		});
	});
});
