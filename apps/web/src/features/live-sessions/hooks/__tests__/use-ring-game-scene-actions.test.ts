import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const ringGameMocks = vi.hoisted(() => ({
	update: vi.fn(),
	isUpdatePending: false,
	currencies: [] as Array<{ id: string; name: string }>,
}));

vi.mock("@/features/stores/hooks/use-ring-games", () => ({
	useRingGames: () => ({
		update: ringGameMocks.update,
		isUpdatePending: ringGameMocks.isUpdatePending,
		currencies: ringGameMocks.currencies,
	}),
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
	},
	trpcClient: {},
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
	ringGameId: "rg1",
	sessionId: "s1",
	storeId: "store-1",
};

describe("useRingGameSceneActions", () => {
	beforeEach(() => {
		ringGameMocks.update.mockReset();
		ringGameMocks.isUpdatePending = false;
		ringGameMocks.currencies = [];
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("starts with isEditOpen=false and exposes pass-through state from useRingGames", () => {
		ringGameMocks.currencies = [{ id: "c1", name: "JPY" }];
		ringGameMocks.isUpdatePending = true;
		const qc = createClient();
		const { result } = renderHook(() => useRingGameSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.isEditOpen).toBe(false);
		expect(result.current.isUpdatePending).toBe(true);
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

	it("handleUpdate calls update with ringGameId merged into values, invalidates session cache, and closes editor", async () => {
		ringGameMocks.update.mockResolvedValue(undefined);
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
			});
		});
		expect(ringGameMocks.update).toHaveBeenCalledWith({
			id: "rg1",
			name: "NL500",
			variant: "nlh",
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

	it("does not close the editor when update rejects (error propagates, editor stays open)", async () => {
		ringGameMocks.update.mockRejectedValue(new Error("fail"));
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
