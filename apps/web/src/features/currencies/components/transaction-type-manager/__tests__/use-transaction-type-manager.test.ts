import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	del: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		transactionType: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("transactionType", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		transactionType: {
			create: { mutate: trpcMocks.create },
			update: { mutate: trpcMocks.update },
			delete: { mutate: trpcMocks.del },
		},
	},
}));

import {
	useTransactionTypeManager,
	useTransactionTypeManagerWithDeleteError,
} from "@/features/currencies/components/transaction-type-manager/use-transaction-type-manager";

const TYPE_LIST_KEY = ["transactionType", "list"];

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function wrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("useTransactionTypeManager", () => {
	beforeEach(() => {
		trpcMocks.create.mockReset();
		trpcMocks.update.mockReset();
		trpcMocks.del.mockReset();
	});

	it("exposes the seeded type list", () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, [
			{ id: "t1", name: "Deposit" },
			{ id: "t2", name: "Withdrawal" },
		]);
		const { result } = renderHook(() => useTransactionTypeManager(), {
			wrapper: wrapper(qc),
		});
		expect(result.current.types).toHaveLength(2);
	});

	it("returns empty array when cache is empty", () => {
		const qc = createClient();
		const { result } = renderHook(() => useTransactionTypeManager(), {
			wrapper: wrapper(qc),
		});
		expect(result.current.types).toEqual([]);
	});

	it("create forwards the name to trpcClient.transactionType.create", async () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, []);
		trpcMocks.create.mockResolvedValue({ id: "t-new", name: "Bonus" });
		const { result } = renderHook(() => useTransactionTypeManager(), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await result.current.create("Bonus");
		});
		expect(trpcMocks.create).toHaveBeenCalledWith({ name: "Bonus" });
	});

	it("update optimistically patches the name of the matching type", async () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, [
			{ id: "t1", name: "Old" },
			{ id: "t2", name: "Other" },
		]);
		let resolveUpdate: ((v: unknown) => void) | undefined;
		trpcMocks.update.mockImplementation(
			() =>
				new Promise((r) => {
					resolveUpdate = r;
				})
		);
		const { result } = renderHook(() => useTransactionTypeManager(), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.update({ id: "t1", name: "New" });
		});
		await waitFor(() => {
			const list =
				qc.getQueryData<Array<{ id: string; name: string }>>(TYPE_LIST_KEY);
			expect(list?.find((t) => t.id === "t1")?.name).toBe("New");
		});
		resolveUpdate?.({ id: "t1", name: "New" });
	});

	it("update onError restores previous snapshot (rollback visible before onSettled refetch)", async () => {
		const qc = createClient();
		const initial = [{ id: "t1", name: "Old" }];
		qc.setQueryData(TYPE_LIST_KEY, initial);
		trpcMocks.update.mockRejectedValue(new Error("boom"));

		const originalSetQueryData = qc.setQueryData.bind(qc);
		let rollbackObserved: Array<{ id: string; name: string }> | undefined;
		vi.spyOn(qc, "setQueryData").mockImplementation(
			<T>(key: unknown, updater: unknown) => {
				const r = originalSetQueryData(
					key as Parameters<typeof originalSetQueryData>[0],
					updater as Parameters<typeof originalSetQueryData>[1]
				) as T;
				const post =
					qc.getQueryData<Array<{ id: string; name: string }>>(TYPE_LIST_KEY);
				if (
					post?.[0]?.name === "Old" &&
					!rollbackObserved &&
					trpcMocks.update.mock.calls.length > 0
				) {
					// only track the rollback write after the optimistic change
					rollbackObserved = post;
				}
				return r;
			}
		);

		const { result } = renderHook(() => useTransactionTypeManager(), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await expect(
				result.current.update({ id: "t1", name: "New" })
			).rejects.toThrow("boom");
		});
		expect(rollbackObserved).toEqual(initial);
	});

	it("delete optimistically removes the matching type", async () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, [
			{ id: "t1", name: "A" },
			{ id: "t2", name: "B" },
		]);
		let resolveDelete: ((v: unknown) => void) | undefined;
		trpcMocks.del.mockImplementation(
			() =>
				new Promise((r) => {
					resolveDelete = r;
				})
		);
		const { result } = renderHook(() => useTransactionTypeManager(), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.delete("t1");
		});
		await waitFor(() => {
			const list =
				qc.getQueryData<Array<{ id: string; name: string }>>(TYPE_LIST_KEY);
			expect(list?.some((t) => t.id === "t1")).toBe(false);
			expect(list?.some((t) => t.id === "t2")).toBe(true);
		});
		resolveDelete?.({ id: "t1" });
	});

	it("isCreatePending flips true during in-flight create", async () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, []);
		let resolveCreate: ((v: unknown) => void) | undefined;
		trpcMocks.create.mockImplementation(
			() =>
				new Promise((r) => {
					resolveCreate = r;
				})
		);
		const { result } = renderHook(() => useTransactionTypeManager(), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.create("Bonus");
		});
		await waitFor(() => expect(result.current.isCreatePending).toBe(true));
		resolveCreate?.({ id: "t-new" });
		await waitFor(() => expect(result.current.isCreatePending).toBe(false));
	});
});

describe("useTransactionTypeManagerWithDeleteError", () => {
	beforeEach(() => {
		trpcMocks.create.mockReset();
		trpcMocks.update.mockReset();
		trpcMocks.del.mockReset();
	});

	it("exposes null deleteError initially", () => {
		const qc = createClient();
		const { result } = renderHook(
			() => useTransactionTypeManagerWithDeleteError(),
			{ wrapper: wrapper(qc) }
		);
		expect(result.current.deleteError).toBeNull();
	});

	it("handleDelete clears previous deleteError and resolves when delete succeeds", async () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, [{ id: "t1", name: "A" }]);
		trpcMocks.del.mockResolvedValue({ id: "t1" });
		const { result } = renderHook(
			() => useTransactionTypeManagerWithDeleteError(),
			{ wrapper: wrapper(qc) }
		);
		await act(async () => {
			await result.current.handleDelete("t1");
		});
		expect(result.current.deleteError).toBeNull();
		expect(trpcMocks.del).toHaveBeenCalledWith({ id: "t1" });
	});

	it("handleDelete captures Error.message into deleteError and rethrows", async () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, [{ id: "t1", name: "A" }]);
		trpcMocks.del.mockRejectedValue(new Error("in use"));
		const { result } = renderHook(
			() => useTransactionTypeManagerWithDeleteError(),
			{ wrapper: wrapper(qc) }
		);
		await act(async () => {
			await expect(result.current.handleDelete("t1")).rejects.toThrow("in use");
		});
		await waitFor(() => expect(result.current.deleteError).toBe("in use"));
	});

	it("handleDelete falls back to 'Failed to delete' for non-Error throws", async () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, [{ id: "t1", name: "A" }]);
		trpcMocks.del.mockRejectedValue("string error");
		const { result } = renderHook(
			() => useTransactionTypeManagerWithDeleteError(),
			{ wrapper: wrapper(qc) }
		);
		await act(async () => {
			await expect(result.current.handleDelete("t1")).rejects.toBeDefined();
		});
		await waitFor(() =>
			expect(result.current.deleteError).toBe("Failed to delete")
		);
	});
});
