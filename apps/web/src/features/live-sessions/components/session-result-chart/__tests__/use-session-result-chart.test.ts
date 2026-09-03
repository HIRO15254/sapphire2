import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

interface CapturedInput {
	liveCashGameSessionId?: string;
	liveTournamentSessionId?: string;
}

const captured: {
	lastInput: CapturedInput | null;
	enabledSeen: boolean | undefined;
} = { lastInput: null, enabledSeen: undefined };

const queryFn = vi.fn(async () => [] as unknown[]);

vi.mock("@/utils/trpc", () => ({
	trpc: {
		sessionEvent: {
			list: {
				queryOptions: (input: CapturedInput) => {
					captured.lastInput = input;
					return {
						queryKey: ["sessionEvent", "list", input],
						queryFn,
					};
				},
			},
		},
	},
}));

import { useSessionResultChart } from "@/features/live-sessions/components/session-result-chart/use-session-result-chart";

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

describe("useSessionResultChart", () => {
	it("does not fetch when enabled=false", () => {
		queryFn.mockClear();
		captured.lastInput = null;
		const { result } = renderHook(
			() =>
				useSessionResultChart({
					liveSessionId: "s1",
					sessionType: "cash_game",
					enabled: false,
				}),
			{ wrapper: wrapper(createClient()) }
		);
		expect(queryFn).not.toHaveBeenCalled();
		expect(result.current.points).toEqual([]);
		expect(result.current.isLoading).toBe(false);
	});

	it.each([
		{
			sessionType: "cash_game" as const,
			liveSessionId: "cash-1",
			expectedInput: { liveCashGameSessionId: "cash-1" },
		},
		{
			sessionType: "tournament" as const,
			liveSessionId: "trn-1",
			expectedInput: { liveTournamentSessionId: "trn-1" },
		},
	])("fetches with $expectedInput for $sessionType sessions when enabled", async ({
		sessionType,
		liveSessionId,
		expectedInput,
	}) => {
		queryFn.mockClear();
		captured.lastInput = null;
		queryFn.mockResolvedValueOnce([]);
		renderHook(
			() =>
				useSessionResultChart({
					liveSessionId,
					sessionType,
					enabled: true,
				}),
			{ wrapper: wrapper(createClient()) }
		);
		await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
		expect(captured.lastInput).toEqual(expectedInput);
	});

	it("derives a cash timeline (pl + evPl) from fetched events", async () => {
		queryFn.mockClear();
		queryFn.mockResolvedValueOnce([
			{
				id: "e1",
				eventType: "session_start",
				occurredAt: "2026-04-01T10:00:00Z",
				payload: { buyInAmount: 10_000 },
			},
			{
				id: "e2",
				eventType: "update_stack",
				occurredAt: "2026-04-01T10:30:00Z",
				payload: { stackAmount: 12_000 },
			},
		]);
		const { result } = renderHook(
			() =>
				useSessionResultChart({
					liveSessionId: "cash-1",
					sessionType: "cash_game",
					enabled: true,
				}),
			{ wrapper: wrapper(createClient()) }
		);
		await waitFor(() => expect(result.current.points).toHaveLength(2));
		expect(result.current.sessionType).toBe("cash_game");
		expect(result.current.isEmpty).toBe(false);
		expect(result.current.points[1]).toMatchObject({ pl: 2000, evPl: 2000 });
	});

	it("derives a tournament timeline (stack + averageStack)", async () => {
		queryFn.mockClear();
		queryFn.mockResolvedValueOnce([
			{
				id: "e1",
				eventType: "session_start",
				occurredAt: "2026-04-01T10:00:00Z",
				payload: {},
			},
			{
				id: "e2",
				eventType: "update_stack",
				occurredAt: "2026-04-01T10:05:00Z",
				payload: { stackAmount: 10_000 },
			},
		]);
		const { result } = renderHook(
			() =>
				useSessionResultChart({
					liveSessionId: "trn-1",
					sessionType: "tournament",
					enabled: true,
				}),
			{ wrapper: wrapper(createClient()) }
		);
		await waitFor(() => expect(result.current.points).toHaveLength(2));
		expect(result.current.sessionType).toBe("tournament");
		expect(result.current.points[1]).toMatchObject({
			stack: 10_000,
			averageStack: null,
		});
	});

	it("reports isEmpty=true when fewer than 2 derived points", async () => {
		queryFn.mockClear();
		queryFn.mockResolvedValueOnce([]);
		const { result } = renderHook(
			() =>
				useSessionResultChart({
					liveSessionId: "cash-1",
					sessionType: "cash_game",
					enabled: true,
				}),
			{ wrapper: wrapper(createClient()) }
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.points).toEqual([]);
		expect(result.current.isEmpty).toBe(true);
	});
});
