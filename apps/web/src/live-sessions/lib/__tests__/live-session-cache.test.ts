import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
	applyOptimisticLiveSessionEvent,
	getHistoricalInvalidationTargets,
	getLiveSessionCacheRefs,
	invalidateLiveSessionCaches,
	type LiveSessionDetailData,
	type LiveSessionListData,
	type LiveSessionPlayersData,
	restoreLiveSessionCaches,
	snapshotLiveSessionCaches,
	transitionLiveSessionStatus,
} from "../live-session-cache";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		currency: {
			list: {
				queryOptions: () => ({
					queryKey: ["currency-list"],
				}),
			},
		},
		currencyTransaction: {
			listByCurrency: {
				queryOptions: ({ currencyId }: { currencyId: string }) => ({
					queryKey: ["currency-transaction-list", currencyId],
				}),
			},
		},
		liveCashGameSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["cash-detail", id],
				}),
			},
			list: {
				queryOptions: (input: Record<string, unknown>) => ({
					queryKey: ["cash-list", input],
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["tournament-detail", id],
				}),
			},
			list: {
				queryOptions: (input: Record<string, unknown>) => ({
					queryKey: ["tournament-list", input],
				}),
			},
		},
		session: {
			list: {
				queryOptions: () => ({
					queryKey: ["session-list"],
				}),
			},
		},
		sessionEvent: {
			list: {
				queryOptions: (input: Record<string, unknown>) => ({
					queryKey: ["session-events", input],
				}),
			},
		},
		sessionTablePlayer: {
			list: {
				queryOptions: (input: Record<string, unknown>) => ({
					queryKey: ["session-players", input],
				}),
			},
		},
	},
}));

function createQueryClientMock(initialData: Record<string, unknown> = {}) {
	const data = new Map<string, unknown>(Object.entries(initialData));

	const queryClient = {
		cancelQueries: vi.fn(async () => undefined),
		getQueryData: vi.fn((queryKey: QueryKey) =>
			data.get(JSON.stringify(queryKey))
		),
		invalidateQueries: vi.fn(async () => undefined),
		setQueryData: vi.fn(
			(
				queryKey: QueryKey,
				updater: unknown | ((previousData: unknown) => unknown)
			) => {
				const key = JSON.stringify(queryKey);
				const previousData = data.get(key);
				const nextData =
					typeof updater === "function"
						? (updater as (previousData: unknown) => unknown)(previousData)
						: updater;
				data.set(key, nextData);
				return nextData;
			}
		),
	} as unknown as QueryClient;

	return {
		data,
		queryClient,
	};
}

describe("live-session-cache", () => {
	it("transitions cash session status and restores from snapshot", () => {
		const refs = getLiveSessionCacheRefs({
			sessionId: "cash-1",
			sessionType: "cash_game",
		});
		const { queryClient } = createQueryClientMock({
			[JSON.stringify(refs.detailKey)]: {
				currencyId: "currency-1",
				status: "active",
			} satisfies LiveSessionDetailData,
			[JSON.stringify(refs.listKeys.active)]: {
				items: [{ id: "cash-1", status: "active" }],
			} satisfies LiveSessionListData,
			[JSON.stringify(refs.listKeys.all)]: {
				items: [{ id: "cash-1", status: "active" }],
			} satisfies LiveSessionListData,
			[JSON.stringify(refs.listKeys.paused)]: {
				items: [],
			} satisfies LiveSessionListData,
			[JSON.stringify(refs.eventsKey)]: [],
			[JSON.stringify(refs.playersKey)]: {
				items: [],
			} satisfies LiveSessionPlayersData,
		});

		const snapshot = snapshotLiveSessionCaches(queryClient, refs);

		transitionLiveSessionStatus(queryClient, refs, "paused");

		expect(queryClient.getQueryData(refs.detailKey)).toEqual(
			expect.objectContaining({ status: "paused" })
		);
		expect(queryClient.getQueryData(refs.listKeys.all)).toEqual({
			items: [{ id: "cash-1", status: "paused" }],
		});
		expect(queryClient.getQueryData(refs.listKeys.active)).toEqual({
			items: [],
		});
		expect(queryClient.getQueryData(refs.listKeys.paused)).toEqual({
			items: [{ id: "cash-1", status: "paused" }],
		});

		restoreLiveSessionCaches(queryClient, snapshot);

		expect(queryClient.getQueryData(refs.detailKey)).toEqual(
			expect.objectContaining({ status: "active" })
		);
		expect(queryClient.getQueryData(refs.listKeys.active)).toEqual({
			items: [{ id: "cash-1", status: "active" }],
		});
	});

	it("transitions tournament sessions back to active", () => {
		const refs = getLiveSessionCacheRefs({
			sessionId: "tournament-1",
			sessionType: "tournament",
		});
		const { queryClient } = createQueryClientMock({
			[JSON.stringify(refs.detailKey)]: {
				status: "paused",
			} satisfies LiveSessionDetailData,
			[JSON.stringify(refs.listKeys.active)]: {
				items: [],
			} satisfies LiveSessionListData,
			[JSON.stringify(refs.listKeys.all)]: {
				items: [{ id: "tournament-1", status: "paused" }],
			} satisfies LiveSessionListData,
			[JSON.stringify(refs.listKeys.paused)]: {
				items: [{ id: "tournament-1", status: "paused" }],
			} satisfies LiveSessionListData,
			[JSON.stringify(refs.eventsKey)]: [],
			[JSON.stringify(refs.playersKey)]: {
				items: [],
			} satisfies LiveSessionPlayersData,
		});

		transitionLiveSessionStatus(queryClient, refs, "active");

		expect(queryClient.getQueryData(refs.detailKey)).toEqual(
			expect.objectContaining({ status: "active" })
		);
		expect(queryClient.getQueryData(refs.listKeys.active)).toEqual({
			items: [{ id: "tournament-1", status: "active" }],
		});
		expect(queryClient.getQueryData(refs.listKeys.paused)).toEqual({
			items: [],
		});
	});

	it("applies optimistic event updates to summary and list data", () => {
		const refs = getLiveSessionCacheRefs({
			sessionId: "cash-2",
			sessionType: "cash_game",
		});
		const { queryClient } = createQueryClientMock({
			[JSON.stringify(refs.detailKey)]: {
				summary: { addonCount: 0, currentStack: 100, totalBuyIn: 500 },
			} satisfies LiveSessionDetailData,
			[JSON.stringify(refs.eventsKey)]: [],
			[JSON.stringify(refs.listKeys.all)]: {
				items: [{ id: "cash-2", latestStackAmount: 100, status: "active" }],
			} satisfies LiveSessionListData,
		});

		applyOptimisticLiveSessionEvent(queryClient, refs, {
			eventType: "update_stack",
			payload: { stackAmount: 250 },
		});
		applyOptimisticLiveSessionEvent(queryClient, refs, {
			eventType: "chips_add_remove",
			payload: { amount: 50, type: "add" },
		});

		expect(queryClient.getQueryData(refs.detailKey)).toEqual(
			expect.objectContaining({
				summary: expect.objectContaining({
					addonCount: 1,
					currentStack: 250,
					totalBuyIn: 550,
				}),
			})
		);
		expect(queryClient.getQueryData(refs.listKeys.all)).toEqual({
			items: [{ id: "cash-2", latestStackAmount: 250, status: "active" }],
		});
	});

	it("builds historical invalidation targets only when currency exists", async () => {
		const refs = getLiveSessionCacheRefs({
			sessionId: "cash-3",
			sessionType: "cash_game",
		});
		const withCurrency = createQueryClientMock({
			[JSON.stringify(refs.detailKey)]: {
				currencyId: "currency-9",
			} satisfies LiveSessionDetailData,
		}).queryClient;
		const withoutCurrency = createQueryClientMock({
			[JSON.stringify(refs.detailKey)]: {
				currencyId: null,
			} satisfies LiveSessionDetailData,
		}).queryClient;

		expect(getHistoricalInvalidationTargets(withCurrency, refs)).toEqual([
			{ queryKey: ["session-list"] },
			{ queryKey: ["currency-list"] },
			{ queryKey: ["currency-transaction-list", "currency-9"] },
		]);
		expect(getHistoricalInvalidationTargets(withoutCurrency, refs)).toEqual([
			{ queryKey: ["session-list"] },
			{ queryKey: ["currency-list"] },
		]);

		await invalidateLiveSessionCaches(withCurrency, refs, {
			includeHistorical: true,
			includeLists: false,
			includePlayers: false,
		});

		expect(withCurrency.invalidateQueries).toHaveBeenCalledWith({
			queryKey: ["session-list"],
		});
		expect(withCurrency.invalidateQueries).toHaveBeenCalledWith({
			queryKey: ["currency-list"],
		});
		expect(withCurrency.invalidateQueries).toHaveBeenCalledWith({
			queryKey: ["currency-transaction-list", "currency-9"],
		});
	});
});
