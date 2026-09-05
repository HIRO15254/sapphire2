import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTestQueryClient as createClient,
	withQueryClient as makeWrapper,
} from "@/__tests__/test-utils";

// ---------------------------------------------------------------------------
// Mocks for trpc — queryOptions returns stable queryKey so the real
// QueryClient can resolve predictable keys. trpcClient.transactionType.create
// is a spy we can configure per-test.
// ---------------------------------------------------------------------------

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	createMutate: vi.fn(),
	list: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		transactionType: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("transactionType", "list", undefined),
					queryFn: trpcMocks.list,
				}),
			},
		},
	},
	trpcClient: {
		transactionType: {
			create: { mutate: trpcMocks.createMutate },
		},
	},
}));

import { useTransactionTypes } from "@/features/currencies/hooks/use-transaction-types";

const TEMP_TYPE_ID_PATTERN = /^temp-type-/;
const TYPE_LIST_KEY = ["transactionType", "list"];

describe("useTransactionTypes", () => {
	beforeEach(() => {
		trpcMocks.createMutate.mockReset();
		trpcMocks.list.mockReset().mockResolvedValue([]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("exposes the list seeded into the QueryClient cache", async () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, [
			{ id: "t1", name: "Deposit" },
			{ id: "t2", name: "Withdrawal" },
		]);
		const { result } = renderHook(() => useTransactionTypes(), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => expect(result.current.types).toHaveLength(2));
		expect(result.current.isCreatingType).toBe(false);
	});

	it("returns empty array when cache has no data", () => {
		const qc = createClient();
		qc.setQueryData(TYPE_LIST_KEY, undefined);
		const { result } = renderHook(() => useTransactionTypes(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.types).toEqual([]);
	});

	describe("createType (optimistic)", () => {
		it("optimistically appends a temp entry to the list during mutation", async () => {
			const qc = createClient();
			qc.setQueryData(TYPE_LIST_KEY, [{ id: "t1", name: "Deposit" }]);
			let resolveMutate: ((value: unknown) => void) | undefined;
			trpcMocks.createMutate.mockImplementation(
				() =>
					new Promise((res) => {
						resolveMutate = res;
					})
			);

			const { result } = renderHook(() => useTransactionTypes(), {
				wrapper: makeWrapper(qc),
			});

			act(() => {
				result.current.createType("Bonus");
			});

			await waitFor(() => {
				const list =
					qc.getQueryData<Array<{ id: string; name: string }>>(TYPE_LIST_KEY);
				expect(list).toHaveLength(2);
				expect(list?.[1]?.name).toBe("Bonus");
				expect(list?.[1]?.id).toMatch(TEMP_TYPE_ID_PATTERN);
			});
			expect(trpcMocks.createMutate).toHaveBeenCalledWith({ name: "Bonus" });

			resolveMutate?.({ id: "t-real", name: "Bonus" });
		});

		it("onSettled invalidates the list query after success", async () => {
			const qc = createClient();
			qc.setQueryData(TYPE_LIST_KEY, []);
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			trpcMocks.createMutate.mockResolvedValue({ id: "t-new", name: "Bonus" });

			const { result } = renderHook(() => useTransactionTypes(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.createType("Bonus");
			});
			expect(invalidateSpy).toHaveBeenCalledWith(
				expect.objectContaining({ queryKey: TYPE_LIST_KEY })
			);
		});

		it("still forwards the mutation when cache was never seeded (fallback `?? []`)", async () => {
			const qc = createClient();
			trpcMocks.createMutate.mockResolvedValue({ id: "t-new", name: "Tip" });
			const { result } = renderHook(() => useTransactionTypes(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.createType("Tip");
			});
			expect(trpcMocks.createMutate).toHaveBeenCalledWith({ name: "Tip" });
		});

		it("removes the rejected optimistic type before refetch responds", async () => {
			const qc = createClient();
			const previous = [{ id: "t1", name: "Deposit" }];
			qc.setQueryData(TYPE_LIST_KEY, previous);
			const mutation = Promise.withResolvers<unknown>();
			const refetch = Promise.withResolvers<typeof previous>();
			trpcMocks.createMutate.mockReturnValue(mutation.promise);
			trpcMocks.list.mockReturnValue(refetch.promise);
			const { result, unmount } = renderHook(() => useTransactionTypes(), {
				wrapper: makeWrapper(qc),
			});
			let completion: Promise<unknown>;
			act(() => {
				completion = result.current
					.createType("Bonus")
					.catch((error: unknown) => error);
			});
			await waitFor(() =>
				expect(result.current.types.map((type) => type.name)).toEqual([
					"Deposit",
					"Bonus",
				])
			);
			await act(async () => {
				mutation.reject(new Error("denied"));
				expect(await completion).toEqual(new Error("denied"));
			});
			await waitFor(() => expect(result.current.types).toEqual(previous));
			expect(qc.getQueryState(TYPE_LIST_KEY)?.fetchStatus).toBe("fetching");
			unmount();
			await qc.cancelQueries();
			qc.clear();
		});

		it("isCreatingType flips to true during in-flight mutation", async () => {
			const qc = createClient();
			qc.setQueryData(TYPE_LIST_KEY, []);
			let resolveMutate: ((value: unknown) => void) | undefined;
			trpcMocks.createMutate.mockImplementation(
				() =>
					new Promise((res) => {
						resolveMutate = res;
					})
			);
			const { result } = renderHook(() => useTransactionTypes(), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.isCreatingType).toBe(false);
			act(() => {
				result.current.createType("Bonus");
			});
			await waitFor(() => expect(result.current.isCreatingType).toBe(true));
			resolveMutate?.({ id: "t", name: "Bonus" });
			await waitFor(() => expect(result.current.isCreatingType).toBe(false));
		});
	});
});
