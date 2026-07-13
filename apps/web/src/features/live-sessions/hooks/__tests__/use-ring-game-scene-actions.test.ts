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
	updateSnapshot: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
				}),
			},
		},
		currency: {
			list: {
				queryOptions: () => ({ queryKey: ["currency", "list"] }),
			},
		},
	},
	trpcClient: {
		liveCashGameSession: {
			updateSnapshot: { mutate: trpcMocks.updateSnapshot },
		},
	},
}));

import { useRingGameSceneActions } from "@/features/live-sessions/hooks/use-ring-game-scene-actions";

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

const ARGS = {
	sessionId: "s1",
};

describe("useRingGameSceneActions", () => {
	beforeEach(() => {
		trpcMocks.updateSnapshot.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("starts with isEditOpen=false and exposes the currencies list", () => {
		const qc = createClient();
		qc.setQueryData(["currency", "list"], [{ id: "c1", name: "JPY" }]);
		const { result } = renderHook(() => useRingGameSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.isEditOpen).toBe(false);
		expect(result.current.isUpdatePending).toBe(false);
		expect(result.current.currencies).toEqual([{ id: "c1", name: "JPY" }]);
	});

	it("opens/closes via setIsEditOpen", () => {
		const qc = createClient();
		const { result } = renderHook(() => useRingGameSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		act(() => {
			result.current.setIsEditOpen(true);
		});
		expect(result.current.isEditOpen).toBe(true);
		act(() => {
			result.current.setIsEditOpen(false);
		});
		expect(result.current.isEditOpen).toBe(false);
	});

	it("handleUpdate writes snapshot fields (not the master), invalidates session cache, and closes editor", async () => {
		trpcMocks.updateSnapshot.mockResolvedValue({ id: "s1" });
		const qc = createClient();
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
		const { result } = renderHook(() => useRingGameSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		act(() => {
			result.current.setIsEditOpen(true);
		});
		await act(async () => {
			await result.current.handleUpdate({
				name: "NL500",
				variant: "nlh",
				mixGames: [
					{
						ante: 1,
						anteType: "all",
						blind1: 2,
						blind2: 4,
						blind3: null,
						name: "Big Bet",
						variants: ["NL Hold'em"],
					},
				],
				blind1: 2,
				blind2: 5,
			});
		});
		expect(trpcMocks.updateSnapshot).toHaveBeenCalledWith({
			id: "s1",
			ruleName: "NL500",
			variant: "nlh",
			mixGames: [
				{
					ante: 1,
					anteType: "all",
					blind1: 2,
					blind2: 4,
					blind3: null,
					name: "Big Bet",
					variants: ["NL Hold'em"],
				},
			],
			blind1: 2,
			blind2: 5,
			blind3: null,
			ante: null,
			anteType: null,
			minBuyIn: null,
			maxBuyIn: null,
			tableSize: null,
		});
		expect(invalidateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				queryKey: ["liveCashGameSession", "getById", { id: "s1" }],
			})
		);
		await waitFor(() => {
			expect(result.current.isEditOpen).toBe(false);
		});
	});

	it("sends an explicit null to clear frozen mix groups", async () => {
		trpcMocks.updateSnapshot.mockResolvedValue({ id: "s1" });
		const qc = createClient();
		const { result } = renderHook(() => useRingGameSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});

		await act(async () => {
			await result.current.handleUpdate({
				name: "NL500",
				variant: "nlh",
				mixGames: null,
			});
		});

		expect(trpcMocks.updateSnapshot).toHaveBeenCalledTimes(1);
		expect(trpcMocks.updateSnapshot).toHaveBeenCalledWith(
			expect.objectContaining({ mixGames: null })
		);
	});

	it("does not close the editor when update rejects (error propagates, editor stays open)", async () => {
		trpcMocks.updateSnapshot.mockRejectedValue(new Error("fail"));
		const qc = createClient();
		const { result } = renderHook(() => useRingGameSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		act(() => {
			result.current.setIsEditOpen(true);
		});
		await act(async () => {
			await expect(
				result.current.handleUpdate({ name: "NL500", variant: "nlh" })
			).rejects.toThrow("fail");
		});
		expect(result.current.isEditOpen).toBe(true);
	});
});
