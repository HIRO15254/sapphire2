import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const queryState = vi.hoisted(() => ({
	query: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: ["liveTournamentSession", "getById", input],
					queryFn: queryState.query,
				}),
			},
		},
	},
}));

import { useSessionTournamentStructure } from "@/features/live-sessions/hooks/use-session-tournament-structure";

const SESSION_KEY = ["liveTournamentSession", "getById", { id: "session-1" }];

function sessionData(overrides: Record<string, unknown> = {}) {
	return {
		ruleName: "Main event",
		variant: "NL Hold'em",
		buyIn: 100,
		entryFee: 10,
		startingStack: 20_000,
		bountyAmount: 25,
		tableSize: 9,
		blindLevels: [],
		chipPurchases: [],
		...overrides,
	};
}

describe("useSessionTournamentStructure", () => {
	beforeEach(() => {
		queryState.query.mockReset();
		queryState.query.mockResolvedValue(undefined);
	});

	it("returns empty display data without starting a query for an empty session id", () => {
		const { result } = renderHook(() => useSessionTournamentStructure(""), {
			wrapper: withQueryClient(),
		});

		expect(result.current.isLoading).toBe(false);
		expect(result.current.display).toBeNull();
		expect(result.current.blindLevels).toEqual([]);
		expect(result.current.chipPurchases).toEqual([]);
		expect(queryState.query).toHaveBeenCalledTimes(0);
	});

	it("reports loading while the session snapshot query is pending", () => {
		queryState.query.mockReturnValue(new Promise(() => undefined));
		const { result } = renderHook(
			() => useSessionTournamentStructure("session-1"),
			{ wrapper: withQueryClient() }
		);

		expect(result.current.isLoading).toBe(true);
		expect(result.current.display).toBeNull();
		expect(result.current.blindLevels).toEqual([]);
		expect(result.current.chipPurchases).toEqual([]);
	});

	it.each([
		["ruleName", null],
		["variant", null],
	])("returns null display when %s is null", (field, value) => {
		const client = createTestQueryClient();
		client.setQueryData(SESSION_KEY, sessionData({ [field]: value }));
		const { result } = renderHook(
			() => useSessionTournamentStructure("session-1"),
			{ wrapper: withQueryClient(client) }
		);

		expect(result.current.display).toBeNull();
	});

	it("maps a complete frozen tournament snapshot", async () => {
		const client = createTestQueryClient();
		client.setQueryData(
			SESSION_KEY,
			sessionData({
				blindLevels: [
					{
						id: "level-1",
						level: 1,
						isBreak: false,
						games: undefined,
						blind1: 100,
						blind2: 200,
						blind3: null,
						ante: 25,
						minutes: 20,
					},
				],
				chipPurchases: [
					{
						id: "purchase-1",
						name: "Rebuy",
						cost: 100,
						chips: 10_000,
						sortOrder: 0,
					},
				],
			})
		);
		const { result } = renderHook(
			() => useSessionTournamentStructure("session-1"),
			{ wrapper: withQueryClient(client) }
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.display).toEqual({
			ruleName: "Main event",
			variant: "NL Hold'em",
			buyIn: 100,
			entryFee: 10,
			startingStack: 20_000,
			bountyAmount: 25,
			tableSize: 9,
		});
		expect(result.current.blindLevels).toEqual([
			{
				id: "level-1",
				level: 1,
				isBreak: false,
				games: null,
				blind1: 100,
				blind2: 200,
				blind3: null,
				ante: 25,
				minutes: 20,
			},
		]);
		expect(result.current.chipPurchases).toEqual([
			{
				id: "purchase-1",
				name: "Rebuy",
				cost: 100,
				chips: 10_000,
				sortOrder: 0,
			},
		]);
	});
});
