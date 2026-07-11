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
	tournamentsByRoom: vi.fn(),
	updateTournament: vi.fn(),
	createWithLevels: vi.fn(),
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
		tournament: {
			listByRoom: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listByRoom", input),
					queryFn: () => mocks.tournamentsByRoom(input),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
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
		liveTournamentSession: {
			update: { mutate: mocks.updateTournament },
		},
		tournament: {
			createWithLevels: { mutate: mocks.createWithLevels },
		},
	},
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { useAssignTournament } from "@/features/live-sessions/components/assign-tournament-dialog/use-assign-tournament";

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

describe("useAssignTournament", () => {
	beforeEach(() => {
		for (const m of Object.values(mocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("defaults mode='existing' and effectiveRoomId is sessionRoomId when present", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignTournament({
					onOpenChange: vi.fn(),
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

	it("handleRoomChange updates selectedRoomId and clears selectedTournamentId", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignTournament({
					onOpenChange: vi.fn(),
					open: false,
					sessionId: "s1",
					sessionRoomId: null,
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.setSelectedTournamentId("t1");
			result.current.handleRoomChange("st2");
		});
		expect(result.current.selectedRoomId).toBe("st2");
		expect(result.current.selectedTournamentId).toBeUndefined();
	});

	it("handleAssign without selectedTournamentId is a no-op", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignTournament({
					onOpenChange: vi.fn(),
					open: true,
					sessionId: "s1",
					sessionRoomId: "room-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.handleAssign();
		});
		expect(mocks.updateTournament).not.toHaveBeenCalled();
	});

	it("handleAssign success calls update, toasts, and closes via onOpenChange(false)", async () => {
		const qc = createClient();
		const onOpenChange = vi.fn();
		mocks.updateTournament.mockResolvedValue({ id: "s1" });
		const { result } = renderHook(
			() =>
				useAssignTournament({
					onOpenChange,
					open: true,
					sessionId: "s1",
					sessionRoomId: "room-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.setSelectedTournamentId("t1");
		});
		act(() => {
			result.current.handleAssign();
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(mocks.updateTournament).toHaveBeenCalledWith({
			id: "s1",
			tournamentId: "t1",
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Tournament assigned");
	});

	it("handleAssign failure surfaces toast error", async () => {
		const qc = createClient();
		mocks.updateTournament.mockRejectedValue(new Error("bad"));
		const { result } = renderHook(
			() =>
				useAssignTournament({
					onOpenChange: vi.fn(),
					open: true,
					sessionId: "s1",
					sessionRoomId: "room-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.setSelectedTournamentId("t1");
		});
		act(() => {
			result.current.handleAssign();
		});
		await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("bad"));
	});

	it("handleCreate without effectiveRoomId toasts error and does not call create", async () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignTournament({
					onOpenChange: vi.fn(),
					open: true,
					sessionId: "s1",
					sessionRoomId: null,
				}),
			{ wrapper: makeWrapper(qc) }
		);
		await act(async () => {
			await result.current.handleCreate(
				{
					name: "Main",
					variant: "nlh",
					buyIn: 100,
					entryFee: 10,
					startingStack: 20_000,
					tableSize: 9,
					currencyId: "c1",
					tags: [],
					chipPurchases: [],
				},
				[]
			);
		});
		expect(mocks.toastError).toHaveBeenCalledWith("Select a room first");
		expect(mocks.createWithLevels).not.toHaveBeenCalled();
	});

	it("handleCreate success chains create + update, toasts, and closes both dialogs", async () => {
		const qc = createClient();
		const onOpenChange = vi.fn();
		mocks.createWithLevels.mockResolvedValue({ id: "new-t" });
		mocks.updateTournament.mockResolvedValue({ id: "s1" });
		const { result } = renderHook(
			() =>
				useAssignTournament({
					onOpenChange,
					open: true,
					sessionId: "s1",
					sessionRoomId: "room-a",
				}),
			{ wrapper: makeWrapper(qc) }
		);
		await act(async () => {
			await result.current.handleCreate(
				{
					name: "Main",
					variant: "nlh",
					buyIn: 100,
					entryFee: 10,
					startingStack: 20_000,
					tableSize: 9,
					currencyId: "c1",
					tags: [],
					chipPurchases: [],
				},
				[
					{
						id: "l1",
						tournamentId: "t-x",
						level: 1,
						isBreak: false,
						blind1: 25,
						blind2: 50,
						blind3: null,
						ante: null,
						minutes: 20,
						games: null,
					},
				]
			);
		});
		await waitFor(() =>
			expect(mocks.toastSuccess).toHaveBeenCalledWith(
				"Tournament created and assigned"
			)
		);
		expect(mocks.createWithLevels).toHaveBeenCalledWith(
			expect.objectContaining({
				roomId: "room-a",
				blindLevels: [
					expect.objectContaining({
						isBreak: false,
						blind1: 25,
						blind2: 50,
						minutes: 20,
						games: null,
					}),
				],
			})
		);
		expect(mocks.updateTournament).toHaveBeenCalledWith({
			id: "s1",
			tournamentId: "new-t",
		});
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(result.current.isCreateDialogOpen).toBe(false);
	});

	it("setMode flips between 'existing' and 'create'", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useAssignTournament({
					onOpenChange: vi.fn(),
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
