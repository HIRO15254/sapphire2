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
	discard: vi.fn(),
	update: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
					queryFn: () => Promise.resolve(null),
				}),
			},
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
	},
	trpcClient: {
		liveTournamentSession: {
			discard: { mutate: trpcMocks.discard },
			update: { mutate: trpcMocks.update },
		},
	},
}));

import { useTournamentSession } from "@/features/live-sessions/hooks/use-tournament-session";

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

describe("useTournamentSession", () => {
	beforeEach(() => {
		navigateMock.mockReset();
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns undefined session when sessionId is empty (query disabled)", () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSession(""), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.session).toBeUndefined();
		expect(result.current.isDiscardPending).toBe(false);
		expect(result.current.isUpdatingTimer).toBe(false);
	});

	it("exposes session data seeded into the cache", async () => {
		const qc = createClient();
		qc.setQueryData(["liveTournamentSession", "getById", { id: "t1" }], {
			id: "t1",
			tournamentId: "tourn-1",
		});
		const { result } = renderHook(() => useTournamentSession("t1"), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => {
			expect(result.current.session).toEqual({
				id: "t1",
				tournamentId: "tourn-1",
			});
		});
	});

	it("discard() calls trpcClient.liveTournamentSession.discard and navigates to /sessions on success", async () => {
		const qc = createClient();
		trpcMocks.discard.mockResolvedValue({ id: "t1" });
		const { result } = renderHook(() => useTournamentSession("t1"), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			result.current.discard();
			await Promise.resolve();
		});
		await waitFor(() => {
			expect(trpcMocks.discard).toHaveBeenCalledWith({ id: "t1" });
		});
		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith({ to: "/sessions" });
		});
	});

	it("updateTimerStartedAt(null) passes null through", async () => {
		const qc = createClient();
		trpcMocks.update.mockResolvedValue({ id: "t1" });
		const { result } = renderHook(() => useTournamentSession("t1"), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			result.current.updateTimerStartedAt(null);
			await Promise.resolve();
		});
		await waitFor(() => {
			expect(trpcMocks.update).toHaveBeenCalledWith({
				id: "t1",
				timerStartedAt: null,
			});
		});
	});

	it("updateTimerStartedAt(Date) converts ms to unix seconds (floored)", async () => {
		const qc = createClient();
		trpcMocks.update.mockResolvedValue({ id: "t1" });
		const { result } = renderHook(() => useTournamentSession("t1"), {
			wrapper: makeWrapper(qc),
		});
		const date = new Date("2026-04-01T12:34:56.789Z");
		await act(async () => {
			result.current.updateTimerStartedAt(date);
			await Promise.resolve();
		});
		await waitFor(() => {
			expect(trpcMocks.update).toHaveBeenCalledWith({
				id: "t1",
				timerStartedAt: Math.floor(date.getTime() / 1000),
			});
		});
	});

	it("flips isUpdatingTimer while the update mutation is in flight", async () => {
		const qc = createClient();
		let resolve: ((v: unknown) => void) | undefined;
		trpcMocks.update.mockImplementation(
			() =>
				new Promise((r) => {
					resolve = r;
				})
		);
		const { result } = renderHook(() => useTournamentSession("t1"), {
			wrapper: makeWrapper(qc),
		});
		act(() => {
			result.current.updateTimerStartedAt(new Date());
		});
		await waitFor(() => expect(result.current.isUpdatingTimer).toBe(true));
		resolve?.({ id: "t1" });
		await waitFor(() => expect(result.current.isUpdatingTimer).toBe(false));
	});
});
