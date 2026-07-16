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
	roomList: vi.fn(),
	ringGamesByRoom: vi.fn(),
	updateCashSession: vi.fn(),
	createAndAssignRingGame: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		room: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("room", "list", undefined),
					queryFn: () => mocks.roomList(),
				}),
			},
		},
		ringGame: {
			listByRoom: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("ringGame", "listByRoom", input),
					queryFn: () => mocks.ringGamesByRoom(input),
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
			createAndAssignRingGame: { mutate: mocks.createAndAssignRingGame },
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
		mocks.roomList.mockResolvedValue([]);
		mocks.ringGamesByRoom.mockResolvedValue([]);
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("defaults mode='existing' and effectiveRoomId comes from sessionRoomId when present", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: false,
					sessionId: "s1",
					sessionRoomId: "room-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		expect(result.current.mode).toBe("existing");
		expect(result.current.effectiveRoomId).toBe("room-a");
		expect(result.current.isBusy).toBe(false);
	});

	it("falls back to selectedRoomId when sessionRoomId is null", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: false,
					sessionId: "s1",
					sessionRoomId: null,
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.setSelectedRoomId("s-room");
		});
		expect(result.current.effectiveRoomId).toBe("s-room");
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
					sessionRoomId: "room-a",
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
					sessionRoomId: "room-a",
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
					sessionRoomId: "room-a",
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

	it("handleCreate without effectiveRoomId surfaces a toast and does not call the mutation", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: true,
					sessionId: "s1",
					sessionRoomId: null,
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
		expect(mocks.toastError).toHaveBeenCalledWith("Select a room first");
		expect(mocks.createAndAssignRingGame).not.toHaveBeenCalled();
	});

	it("handleCreate calls the atomic create-and-assign RPC once, invalidates every affected query, toasts success, and closes", async () => {
		const qc = createClient();
		const onClose = vi.fn();
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
		mocks.createAndAssignRingGame.mockResolvedValue({
			sessionId: "s1",
			ringGameId: "new-rg",
		});
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose,
					open: true,
					sessionId: "s1",
					sessionRoomId: "room-a",
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
		expect(mocks.createAndAssignRingGame).toHaveBeenCalledTimes(1);
		expect(mocks.createAndAssignRingGame).toHaveBeenCalledWith({
			sessionId: "s1",
			roomId: "room-a",
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
		expect(mocks.updateCashSession).not.toHaveBeenCalled();
		expect(invalidateSpy).toHaveBeenCalledTimes(4);
		expect(invalidateSpy).toHaveBeenNthCalledWith(1, {
			queryKey: ["liveCashGameSession", "getById", { id: "s1" }],
		});
		expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
			queryKey: ["liveCashGameSession", "list", {}],
		});
		expect(invalidateSpy).toHaveBeenNthCalledWith(3, {
			queryKey: ["session", "list", {}],
		});
		expect(invalidateSpy).toHaveBeenNthCalledWith(4, {
			queryKey: ["ringGame", "listByRoom", { roomId: "room-a" }],
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			"Game created and assigned"
		);
	});

	it("handleCreate failure toasts once, leaves the dialog open, and invalidates nothing", async () => {
		const qc = createClient();
		const onClose = vi.fn();
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
		mocks.createAndAssignRingGame.mockRejectedValue(new Error("name taken"));
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose,
					open: true,
					sessionId: "s1",
					sessionRoomId: "room-a",
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
		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
		expect(invalidateSpy).not.toHaveBeenCalled();
		expect(mocks.updateCashSession).not.toHaveBeenCalled();
	});

	it("handleCreate uses the atomic-operation fallback when the server error has no message", async () => {
		const qc = createClient();
		mocks.createAndAssignRingGame.mockRejectedValue({ message: "" });
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: true,
					sessionId: "s1",
					sessionRoomId: "room-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.handleCreate({ name: "1/2", variant: "nlh" });
		});
		await waitFor(() =>
			expect(mocks.toastError).toHaveBeenCalledWith(
				"Failed to create and assign game"
			)
		);
		expect(mocks.toastError).toHaveBeenCalledTimes(1);
	});

	it("setMode toggles between 'existing' and 'create'", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignRingGame({
					onClose: vi.fn(),
					open: false,
					sessionId: "s1",
					sessionRoomId: "room-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.setMode("create");
		});
		expect(result.current.mode).toBe("create");
	});
});
