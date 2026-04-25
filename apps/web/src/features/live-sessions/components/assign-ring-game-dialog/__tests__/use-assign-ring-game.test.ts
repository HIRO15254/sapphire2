import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const mocks = vi.hoisted(() => ({
	storeList: vi.fn(),
	ringGamesByStore: vi.fn(),
	updateCashSession: vi.fn(),
	createRingGame: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		store: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("store", "list", undefined),
					queryFn: () => mocks.storeList(),
				}),
			},
		},
		ringGame: {
			listByStore: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("ringGame", "listByStore", input),
					queryFn: () => mocks.ringGamesByStore(input),
				}),
			},
		},
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
				}),
			},
		},
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
				}),
			},
		},
	},
	trpcClient: {
		liveCashGameSession: {
			update: { mutate: mocks.updateCashSession },
		},
		ringGame: {
			create: { mutate: mocks.createRingGame },
		},
	},
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { useAssignRingGame } from "@/features/live-sessions/components/assign-ring-game-dialog/use-assign-ring-game";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("useAssignRingGame", () => {
	beforeEach(() => {
		for (const m of Object.values(mocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("defaults mode='existing' and effectiveStoreId comes from sessionStoreId when present", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: false,
					sessionId: "s1",
					sessionStoreId: "store-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		expect(result.current.mode).toBe("existing");
		expect(result.current.effectiveStoreId).toBe("store-a");
		expect(result.current.isBusy).toBe(false);
	});

	it("falls back to selectedStoreId when sessionStoreId is null", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: false,
					sessionId: "s1",
					sessionStoreId: null,
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.setSelectedStoreId("s-store");
		});
		expect(result.current.effectiveStoreId).toBe("s-store");
	});

	it("selectForm submits nothing when ringGameId is empty", async () => {
		const qc = createClient();
		const onClose = vi.fn();
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose,
					open: true,
					sessionId: "s1",
					sessionStoreId: "store-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		await act(async () => {
			await result.current.selectForm.handleSubmit();
		});
		expect(mocks.updateCashSession).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("selectForm submit triggers the assign mutation, toasts success, and closes on success", async () => {
		const qc = createClient();
		const onClose = vi.fn();
		mocks.updateCashSession.mockResolvedValue({ id: "s1" });
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose,
					open: true,
					sessionId: "s1",
					sessionStoreId: "store-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.selectForm.setFieldValue("ringGameId", "rg1");
		});
		await act(async () => {
			await result.current.selectForm.handleSubmit();
		});
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
		expect(mocks.updateCashSession).toHaveBeenCalledWith({
			id: "s1",
			ringGameId: "rg1",
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Game assigned");
	});

	it("assign mutation error toasts the error message", async () => {
		const qc = createClient();
		mocks.updateCashSession.mockRejectedValue(new Error("conflict"));
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: true,
					sessionId: "s1",
					sessionStoreId: "store-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.selectForm.setFieldValue("ringGameId", "rg1");
		});
		await act(async () => {
			await result.current.selectForm.handleSubmit();
		});
		await waitFor(() =>
			expect(mocks.toastError).toHaveBeenCalledWith("conflict")
		);
	});

	it("handleCreate without effectiveStoreId surfaces a toast and does not call the mutation", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: true,
					sessionId: "s1",
					sessionStoreId: null,
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.handleCreate({
				name: "1/2",
				variant: "nlh",
				blind1: 1,
				blind2: 2,
				anteType: "none",
				tableSize: 9,
				minBuyIn: 40,
				maxBuyIn: 200,
				currencyId: "c1",
			});
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Select a store first");
		expect(mocks.createRingGame).not.toHaveBeenCalled();
	});

	it("handleCreate calls ringGame.create then session.update, toasts success, and closes", async () => {
		const qc = createClient();
		const onClose = vi.fn();
		mocks.createRingGame.mockResolvedValue({ id: "new-rg" });
		mocks.updateCashSession.mockResolvedValue({ id: "s1" });
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose,
					open: true,
					sessionId: "s1",
					sessionStoreId: "store-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.handleCreate({
				name: "1/2",
				variant: "nlh",
				blind1: 1,
				blind2: 2,
				anteType: "none",
				tableSize: 9,
				minBuyIn: 40,
				maxBuyIn: 200,
				currencyId: "c1",
			});
		});
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
		expect(mocks.createRingGame).toHaveBeenCalledTimes(1);
		expect(mocks.updateCashSession).toHaveBeenCalledWith({
			id: "s1",
			ringGameId: "new-rg",
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			"Game created and assigned"
		);
	});

	it("handleCreate failure toasts the error message", async () => {
		const qc = createClient();
		mocks.createRingGame.mockRejectedValue(new Error("name taken"));
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: true,
					sessionId: "s1",
					sessionStoreId: "store-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.handleCreate({
				name: "x",
				variant: "nlh",
				blind1: 1,
				blind2: 2,
				anteType: "none",
				tableSize: 9,
			});
		});
		await waitFor(() =>
			expect(mocks.toastError).toHaveBeenCalledWith("name taken")
		);
	});

	it("setMode toggles between 'existing' and 'create'", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: false,
					sessionId: "s1",
					sessionStoreId: "store-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.setMode("create");
		});
		expect(result.current.mode).toBe("create");
	});
});
