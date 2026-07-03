import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const navigateMock = vi.hoisted(() => vi.fn());
const trpcMocks = vi.hoisted(() => ({
	createCash: vi.fn(),
	createTournament: vi.fn(),
	sessionEventCreate: vi.fn(),
	roomUpdate: vi.fn(),
}));
const geoMock = vi.hoisted(() => ({
	coords: null as { latitude: number; longitude: number } | null,
}));
const toastMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

vi.mock("@/shared/hooks/use-geolocation", () => ({
	useGeolocation: () => ({
		coords: geoMock.coords,
		status: "idle",
		error: null,
		request: vi.fn(),
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
		liveTournamentSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		room: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("room", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		currency: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("currency", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		ringGame: {
			listByRoom: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("ringGame", "listByRoom", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		tournament: {
			listByRoom: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listByRoom", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		liveCashGameSession: {
			create: { mutate: trpcMocks.createCash },
		},
		liveTournamentSession: {
			create: { mutate: trpcMocks.createTournament },
		},
		sessionEvent: {
			create: { mutate: trpcMocks.sessionEventCreate },
		},
		room: {
			update: { mutate: trpcMocks.roomUpdate },
		},
	},
}));

import { useCreateSession } from "@/features/live-sessions/hooks/use-create-session";

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

describe("useCreateSession", () => {
	beforeEach(() => {
		navigateMock.mockReset();
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
		toastMock.success.mockReset();
		toastMock.error.mockReset();
		geoMock.coords = null;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("exposes empty arrays and undefined selectedRoomId by default", () => {
			const qc = createClient();
			const onClose = vi.fn();
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.rooms).toEqual([]);
			expect(result.current.currencies).toEqual([]);
			expect(result.current.ringGames).toEqual([]);
			expect(result.current.tournaments).toEqual([]);
			expect(result.current.selectedRoomId).toBeUndefined();
			expect(result.current.isLoading).toBe(false);
		});

		it("projects rooms to {id,name} and currencies to {id,name}", async () => {
			const qc = createClient();
			qc.setQueryData(
				["room", "list"],
				[{ id: "s1", name: "Room 1", extra: "ignored" }]
			);
			qc.setQueryData(
				["currency", "list"],
				[{ id: "c1", name: "JPY", unit: "¥" }]
			);
			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn() }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => {
				expect(result.current.rooms).toEqual([{ id: "s1", name: "Room 1" }]);
				expect(result.current.currencies).toEqual([{ id: "c1", name: "JPY" }]);
			});
		});
	});

	describe("setSelectedRoomId", () => {
		it("enables ringGames + tournaments queries when a room is selected, projecting rows", async () => {
			const qc = createClient();
			qc.setQueryData(
				["ringGame", "listByRoom", { roomId: "s1" }],
				[
					{
						id: "rg1",
						name: "NL100",
						minBuyIn: 1000,
						maxBuyIn: 10_000,
						currencyId: "c1",
						extra: "ignored",
					},
				]
			);
			qc.setQueryData(
				["tournament", "listByRoom", { roomId: "s1", includeArchived: false }],
				[
					{
						id: "t1",
						name: "Main",
						buyIn: 10_000,
						entryFee: 1000,
						startingStack: 20_000,
						currencyId: "c1",
						extra: "ignored",
					},
				]
			);

			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn() }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.setSelectedRoomId("s1");
			});
			await waitFor(() => {
				expect(result.current.ringGames).toEqual([
					{
						id: "rg1",
						name: "NL100",
						minBuyIn: 1000,
						maxBuyIn: 10_000,
						currencyId: "c1",
					},
				]);
				expect(result.current.tournaments).toEqual([
					{
						id: "t1",
						name: "Main",
						buyIn: 10_000,
						entryFee: 1000,
						startingStack: 20_000,
						currencyId: "c1",
					},
				]);
			});
		});
	});

	describe("createCash", () => {
		it("forwards the full payload to liveCashGameSession.create and navigates to /active-session on success", async () => {
			const qc = createClient();
			const onClose = vi.fn();
			trpcMocks.createCash.mockResolvedValue({ id: "new-1" });
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.createCash({
					currencyId: "c1",
					initialBuyIn: 5000,
					memo: "note",
					ringGameId: "rg1",
					roomId: "s1",
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.createCash).toHaveBeenCalledWith({
					currencyId: "c1",
					initialBuyIn: 5000,
					memo: "note",
					ringGameId: "rg1",
					roomId: "s1",
				});
			});
			await waitFor(() => {
				expect(onClose).toHaveBeenCalledTimes(1);
				expect(navigateMock).toHaveBeenCalledWith({ to: "/active-session" });
			});
		});

		it("reflects isLoading=true while createCash is in flight", async () => {
			const qc = createClient();
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.createCash.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn() }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.createCash({ initialBuyIn: 1 });
			});
			await waitFor(() => expect(result.current.isLoading).toBe(true));
			resolve?.({ id: "x" });
			await waitFor(() => expect(result.current.isLoading).toBe(false));
		});
	});

	describe("createTournament", () => {
		it("creates the tournament, then creates an initial update_stack event with startingStack payload", async () => {
			const qc = createClient();
			const onClose = vi.fn();
			trpcMocks.createTournament.mockResolvedValue({ id: "tr-1" });
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "ev-1" });
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.createTournament({
					buyIn: 10_000,
					startingStack: 20_000,
					currencyId: "c1",
					roomId: "s1",
					tournamentId: "tourn-1",
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.createTournament).toHaveBeenCalledWith({
					buyIn: 10_000,
					currencyId: "c1",
					roomId: "s1",
					tournamentId: "tourn-1",
				});
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					liveTournamentSessionId: "tr-1",
					eventType: "update_stack",
					payload: { stackAmount: 20_000 },
				});
			});
			await waitFor(() => {
				expect(onClose).toHaveBeenCalledTimes(1);
				expect(navigateMock).toHaveBeenCalledWith({ to: "/active-session" });
			});
		});

		it("does not fire navigation / sessionEvent create when createTournament rejects", async () => {
			const qc = createClient();
			const onClose = vi.fn();
			trpcMocks.createTournament.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.createTournament({
					buyIn: 10_000,
					startingStack: 20_000,
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.createTournament).toHaveBeenCalled();
			});
			await Promise.resolve();
			expect(trpcMocks.sessionEventCreate).not.toHaveBeenCalled();
			expect(navigateMock).not.toHaveBeenCalled();
			expect(onClose).not.toHaveBeenCalled();
		});
	});

	describe("nearestRoomId (geolocation default)", () => {
		function seedRooms(qc: QueryClient) {
			qc.setQueryData(
				["room", "list"],
				[
					{
						id: "osaka",
						name: "Osaka",
						latitude: 34.6937,
						longitude: 135.5023,
					},
					{
						id: "tokyo",
						name: "Tokyo",
						latitude: 35.6812,
						longitude: 139.7671,
					},
				]
			);
		}

		it("resolves to the closest in-range room when coords are available", async () => {
			geoMock.coords = { latitude: 35.6812, longitude: 139.7671 };
			const qc = createClient();
			seedRooms(qc);
			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn(), open: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.nearestRoomId).toBe("tokyo"));
		});

		it("is undefined when location is unavailable", async () => {
			geoMock.coords = null;
			const qc = createClient();
			seedRooms(qc);
			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn(), open: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.rooms).toHaveLength(2));
			expect(result.current.nearestRoomId).toBeUndefined();
		});

		it("is undefined when no room is within the radius", async () => {
			geoMock.coords = { latitude: 35.6812, longitude: 139.7671 };
			const qc = createClient();
			qc.setQueryData(
				["room", "list"],
				[
					{
						id: "osaka",
						name: "Osaka",
						latitude: 34.6937,
						longitude: 135.5023,
					},
				]
			);
			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn(), open: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));
			expect(result.current.nearestRoomId).toBeUndefined();
		});

		it("ignores rooms without coordinates", async () => {
			geoMock.coords = { latitude: 35.6812, longitude: 139.7671 };
			const qc = createClient();
			qc.setQueryData(
				["room", "list"],
				[{ id: "no-coords", name: "Legacy", latitude: null, longitude: null }]
			);
			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn(), open: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));
			expect(result.current.nearestRoomId).toBeUndefined();
		});
	});

	describe("locationPrompt (SA2-100 save room location)", () => {
		const COORDS = { latitude: 35.6812, longitude: 139.7671 };

		function seedRoom(
			qc: QueryClient,
			room: { latitude: number | null; longitude: number | null }
		) {
			qc.setQueryData(
				["room", "list"],
				[{ id: "s1", name: "Room 1", ...room }]
			);
		}

		function renderReady(qc: QueryClient, onClose = vi.fn()) {
			const view = renderHook(() => useCreateSession({ onClose, open: true }), {
				wrapper: makeWrapper(qc),
			});
			return view;
		}

		it("is closed with an empty room name by default", () => {
			const qc = createClient();
			const { result } = renderReady(qc);
			expect(result.current.locationPrompt.open).toBe(false);
			expect(result.current.locationPrompt.roomName).toBe("");
		});

		it("opens the prompt instead of starting when the room has no coordinates and a fix is available", async () => {
			geoMock.coords = COORDS;
			const qc = createClient();
			seedRoom(qc, { latitude: null, longitude: null });
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createCash({ initialBuyIn: 5000, roomId: "s1" });
			});

			expect(result.current.locationPrompt.open).toBe(true);
			expect(result.current.locationPrompt.roomName).toBe("Room 1");
			expect(trpcMocks.createCash).not.toHaveBeenCalled();
		});

		it("starts the session without saving when the prompt is skipped", async () => {
			geoMock.coords = COORDS;
			const qc = createClient();
			seedRoom(qc, { latitude: null, longitude: null });
			trpcMocks.createCash.mockResolvedValue({ id: "c-1" });
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createCash({ initialBuyIn: 5000, roomId: "s1" });
			});
			act(() => {
				result.current.locationPrompt.onSkip();
			});

			expect(result.current.locationPrompt.open).toBe(false);
			expect(trpcMocks.roomUpdate).not.toHaveBeenCalled();
			await waitFor(() =>
				expect(trpcMocks.createCash).toHaveBeenCalledWith({
					initialBuyIn: 5000,
					roomId: "s1",
				})
			);
		});

		it("saves the current location to the room then starts the session", async () => {
			geoMock.coords = COORDS;
			const qc = createClient();
			seedRoom(qc, { latitude: null, longitude: null });
			trpcMocks.createCash.mockResolvedValue({ id: "c-1" });
			trpcMocks.roomUpdate.mockResolvedValue({ id: "s1" });
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createCash({ initialBuyIn: 5000, roomId: "s1" });
			});
			act(() => {
				result.current.locationPrompt.onSave();
			});

			expect(result.current.locationPrompt.open).toBe(false);
			await waitFor(() =>
				expect(trpcMocks.roomUpdate).toHaveBeenCalledWith({
					id: "s1",
					latitude: COORDS.latitude,
					longitude: COORDS.longitude,
				})
			);
			await waitFor(() =>
				expect(trpcMocks.createCash).toHaveBeenCalledWith({
					initialBuyIn: 5000,
					roomId: "s1",
				})
			);
			await waitFor(() =>
				expect(toastMock.success).toHaveBeenCalledWith("Room location saved")
			);
			expect(toastMock.success).toHaveBeenCalledTimes(1);
			expect(toastMock.error).not.toHaveBeenCalled();
		});

		it("toasts an error but still starts the session when the location save fails", async () => {
			geoMock.coords = COORDS;
			const qc = createClient();
			seedRoom(qc, { latitude: null, longitude: null });
			trpcMocks.createCash.mockResolvedValue({ id: "c-1" });
			trpcMocks.roomUpdate.mockRejectedValue(new Error("network"));
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createCash({ initialBuyIn: 5000, roomId: "s1" });
			});
			act(() => {
				result.current.locationPrompt.onSave();
			});

			await waitFor(() =>
				expect(toastMock.error).toHaveBeenCalledWith(
					"Couldn't save room location"
				)
			);
			expect(toastMock.error).toHaveBeenCalledTimes(1);
			expect(toastMock.success).not.toHaveBeenCalled();
			await waitFor(() =>
				expect(trpcMocks.createCash).toHaveBeenCalledWith({
					initialBuyIn: 5000,
					roomId: "s1",
				})
			);
		});

		it("does not toast when the prompt is skipped without saving", async () => {
			geoMock.coords = COORDS;
			const qc = createClient();
			seedRoom(qc, { latitude: null, longitude: null });
			trpcMocks.createCash.mockResolvedValue({ id: "c-1" });
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createCash({ initialBuyIn: 5000, roomId: "s1" });
			});
			act(() => {
				result.current.locationPrompt.onSkip();
			});

			await waitFor(() =>
				expect(trpcMocks.createCash).toHaveBeenCalledTimes(1)
			);
			expect(toastMock.success).not.toHaveBeenCalled();
			expect(toastMock.error).not.toHaveBeenCalled();
		});

		it("treats a dismissal (onOpenChange false) as a skip", async () => {
			geoMock.coords = COORDS;
			const qc = createClient();
			seedRoom(qc, { latitude: null, longitude: null });
			trpcMocks.createCash.mockResolvedValue({ id: "c-1" });
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createCash({ initialBuyIn: 5000, roomId: "s1" });
			});
			act(() => {
				result.current.locationPrompt.onOpenChange(false);
			});

			expect(result.current.locationPrompt.open).toBe(false);
			expect(trpcMocks.roomUpdate).not.toHaveBeenCalled();
			await waitFor(() =>
				expect(trpcMocks.createCash).toHaveBeenCalledTimes(1)
			);
		});

		it("does not open the prompt when the room already has coordinates", async () => {
			geoMock.coords = COORDS;
			const qc = createClient();
			seedRoom(qc, { latitude: 35.68, longitude: 139.76 });
			trpcMocks.createCash.mockResolvedValue({ id: "c-1" });
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createCash({ initialBuyIn: 5000, roomId: "s1" });
			});

			expect(result.current.locationPrompt.open).toBe(false);
			await waitFor(() =>
				expect(trpcMocks.createCash).toHaveBeenCalledTimes(1)
			);
		});

		it("does not open the prompt when no device fix is available", async () => {
			geoMock.coords = null;
			const qc = createClient();
			seedRoom(qc, { latitude: null, longitude: null });
			trpcMocks.createCash.mockResolvedValue({ id: "c-1" });
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createCash({ initialBuyIn: 5000, roomId: "s1" });
			});

			expect(result.current.locationPrompt.open).toBe(false);
			await waitFor(() =>
				expect(trpcMocks.createCash).toHaveBeenCalledTimes(1)
			);
		});

		it("does not open the prompt when the chosen room is not in the list", async () => {
			geoMock.coords = COORDS;
			const qc = createClient();
			seedRoom(qc, { latitude: null, longitude: null });
			trpcMocks.createCash.mockResolvedValue({ id: "c-1" });
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createCash({ initialBuyIn: 5000, roomId: "missing" });
			});

			expect(result.current.locationPrompt.open).toBe(false);
			await waitFor(() =>
				expect(trpcMocks.createCash).toHaveBeenCalledTimes(1)
			);
		});

		it("prompts for a tournament start too, then saves before starting", async () => {
			geoMock.coords = COORDS;
			const qc = createClient();
			seedRoom(qc, { latitude: null, longitude: null });
			trpcMocks.createTournament.mockResolvedValue({ id: "t-1" });
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "ev-1" });
			trpcMocks.roomUpdate.mockResolvedValue({ id: "s1" });
			const { result } = renderReady(qc);
			await waitFor(() => expect(result.current.rooms).toHaveLength(1));

			act(() => {
				result.current.createTournament({
					buyIn: 10_000,
					startingStack: 20_000,
					roomId: "s1",
				});
			});
			expect(result.current.locationPrompt.open).toBe(true);
			expect(trpcMocks.createTournament).not.toHaveBeenCalled();

			act(() => {
				result.current.locationPrompt.onSave();
			});
			await waitFor(() =>
				expect(trpcMocks.roomUpdate).toHaveBeenCalledWith({
					id: "s1",
					latitude: COORDS.latitude,
					longitude: COORDS.longitude,
				})
			);
			await waitFor(() =>
				expect(trpcMocks.createTournament).toHaveBeenCalledWith({
					buyIn: 10_000,
					roomId: "s1",
				})
			);
		});
	});
});
