import { ALL_EVENT_TYPES } from "@sapphire2/db/constants/session-event-types";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("sessionEvent router structure", () => {
	it("appRouter has sessionEvent namespace", () => {
		expect(appRouter.sessionEvent).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.sessionEvent).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.sessionEvent.list);
		expectType(appRouter.sessionEvent.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.sessionEvent.create,
			appRouter.sessionEvent.update,
			appRouter.sessionEvent.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("sessionEvent.list input validation", () => {
	// Note: the cross-field rule "exactly one session id" is enforced at
	// runtime via `validateExactlyOneSessionId`, not by the Zod schema.
	// The schema accepts any combination here.

	it("accepts liveCashGameSessionId only", () => {
		expectAccepts(appRouter.sessionEvent.list, {
			liveCashGameSessionId: "lcg1",
		});
	});

	it("accepts liveTournamentSessionId only", () => {
		expectAccepts(appRouter.sessionEvent.list, {
			liveTournamentSessionId: "lt1",
		});
	});

	it("accepts new sessionId field (CTI shim)", () => {
		expectAccepts(appRouter.sessionEvent.list, {
			sessionId: "gs1",
		});
	});

	it("accepts empty object (runtime will reject)", () => {
		expectAccepts(appRouter.sessionEvent.list, {});
	});

	it("rejects non-string session id", () => {
		expectRejects(appRouter.sessionEvent.list, {
			liveCashGameSessionId: 123,
		});
	});
});

describe("sessionEvent.create input validation", () => {
	const baseline = {
		liveCashGameSessionId: "lcg1",
		eventType: "update_stack",
		payload: { stackAmount: 500 },
	} as const;

	it("accepts a valid event creation payload", () => {
		expectAccepts(appRouter.sessionEvent.create, baseline);
	});

	it("accepts all known event types", () => {
		for (const eventType of ALL_EVENT_TYPES) {
			expectAccepts(appRouter.sessionEvent.create, {
				liveCashGameSessionId: "lcg1",
				eventType,
				payload: {},
			});
		}
	});

	it("rejects unknown event type", () => {
		expectRejects(appRouter.sessionEvent.create, {
			liveCashGameSessionId: "lcg1",
			eventType: "totally_made_up_event",
			payload: {},
		});
	});

	it("accepts optional occurredAt timestamp", () => {
		expectAccepts(appRouter.sessionEvent.create, {
			...baseline,
			occurredAt: 1_700_000_000,
		});
	});

	it("rejects non-number occurredAt", () => {
		expectRejects(appRouter.sessionEvent.create, {
			...baseline,
			occurredAt: "2024-01-01",
		});
	});

	it("accepts tournament session variant", () => {
		expectAccepts(appRouter.sessionEvent.create, {
			liveTournamentSessionId: "lt1",
			eventType: "purchase_chips",
			payload: {
				sessionChipPurchaseId: "scp-1",
				name: "Rebuy",
				cost: 100,
				chips: 10_000,
			},
		});
	});
});

describe("sessionEvent.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.sessionEvent.update, { id: "ev1" });
	});

	it("accepts occurredAt update", () => {
		expectAccepts(appRouter.sessionEvent.update, {
			id: "ev1",
			occurredAt: 1_700_000_000,
		});
	});

	it("accepts payload replacement", () => {
		expectAccepts(appRouter.sessionEvent.update, {
			id: "ev1",
			payload: { stackAmount: 1000 },
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.sessionEvent.update, {
			payload: { stackAmount: 1000 },
		});
	});

	it("rejects non-number occurredAt", () => {
		expectRejects(appRouter.sessionEvent.update, {
			id: "ev1",
			occurredAt: "later",
		});
	});
});

describe("sessionEvent.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.sessionEvent.delete, { id: "ev1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.sessionEvent.delete, {});
	});
});

describe("sessionEvent ownership errors hide resource existence", () => {
	function makeCaller(select: Record<string, Record<string, unknown>[]>) {
		const { db } = createChainableMockDb({ select });
		return appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).sessionEvent;
	}

	it.each([
		["missing", []],
		[
			"foreign",
			[
				{
					id: "session-1",
					userId: "user-2",
					kind: "cash_game",
					status: "active",
				},
			],
		],
	])("returns FORBIDDEN when the listed session is %s", async (_case, sessions) => {
		const caller = makeCaller({ game_session: sessions });

		await expect(caller.list({ sessionId: "session-1" })).rejects.toMatchObject(
			{ code: "FORBIDDEN" }
		);
	});

	it.each([
		["missing", []],
		[
			"foreign",
			[
				{
					id: "event-1",
					sessionId: "session-1",
					eventType: "update_stack",
					payload: "{}",
				},
			],
		],
	])("returns FORBIDDEN when the mutated event is %s", async (_case, events) => {
		const caller = makeCaller({
			session_event: events,
			game_session: [
				{
					id: "session-1",
					userId: "user-2",
					kind: "cash_game",
					status: "active",
				},
			],
		});

		for (const call of [
			() => caller.update({ id: "event-1" }),
			() => caller.delete({ id: "event-1" }),
		]) {
			await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
	});

	it("checks ownership before exposing that a foreign event is lifecycle-protected", async () => {
		const caller = makeCaller({
			session_event: [
				{
					id: "event-1",
					sessionId: "session-1",
					eventType: "session_start",
					payload: "{}",
				},
			],
			game_session: [
				{
					id: "session-1",
					userId: "user-2",
					kind: "cash_game",
					status: "active",
				},
			],
		});

		await expect(caller.delete({ id: "event-1" })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});
});

describe("sessionEvent purchase_chips scoping", () => {
	const userId = "user-1";
	const sessionId = "session-1";
	const occurredAt = new Date("2026-05-01T12:00:00.000Z");
	const canonicalPurchase = {
		id: "purchase-1",
		sessionId,
		name: "Rebuy",
		cost: 100,
		chips: 10_000,
	};
	const tamperedPayload = {
		sessionChipPurchaseId: canonicalPurchase.id,
		name: "Forged",
		cost: 1_000_000,
		chips: 1,
	};

	function makeCaller(options: {
		eventType?: "memo" | "player_join" | "player_leave" | "purchase_chips";
		eventPayload?: Record<string, unknown>;
		players?: Record<string, unknown>[];
		purchases?: Record<string, unknown>[];
	}) {
		const eventType = options.eventType ?? "memo";
		const eventPayload = options.eventPayload ?? {};
		const { db, inserted, updated } = createChainableMockDb({
			select: {
				game_session: [
					{
						id: sessionId,
						userId,
						kind: "tournament",
						status: "active",
						sessionDate: occurredAt,
						startedAt: occurredAt,
						currencyId: null,
					},
				],
				session_event: [
					{
						id: "event-1",
						sessionId,
						eventType,
						payload: JSON.stringify(eventPayload),
						occurredAt,
						sortOrder: 0,
					},
				],
				player: options.players ?? [],
				session_chip_purchase: options.purchases ?? [],
			},
		});
		const caller = appRouter.createCaller({
			session: { user: { id: userId } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).sessionEvent;
		return { caller, inserted, updated };
	}

	function parseFirstEventPayload(writes: unknown[] | undefined) {
		const write = writes?.[0] as { payload?: unknown } | undefined;
		if (!write || typeof write.payload !== "string") {
			throw new Error("Expected a session event write with a JSON payload");
		}
		return JSON.parse(write.payload) as unknown;
	}

	it.each([
		["missing", []],
		["another session", [{ ...canonicalPurchase, sessionId: "session-2" }]],
	])("rejects create when the referenced chip purchase is %s", async (_case, purchases) => {
		const { caller, inserted } = makeCaller({ purchases });

		await expect(
			caller.create({
				liveTournamentSessionId: sessionId,
				eventType: "purchase_chips",
				occurredAt: occurredAt.getTime() / 1000,
				payload: tamperedPayload,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(inserted.session_event).toBeUndefined();
	});

	it("writes the server-side chip-purchase snapshot on create", async () => {
		const { caller, inserted } = makeCaller({
			purchases: [canonicalPurchase],
		});

		await caller.create({
			liveTournamentSessionId: sessionId,
			eventType: "purchase_chips",
			occurredAt: occurredAt.getTime() / 1000,
			payload: tamperedPayload,
		});

		expect(parseFirstEventPayload(inserted.session_event)).toEqual({
			sessionChipPurchaseId: canonicalPurchase.id,
			name: canonicalPurchase.name,
			cost: canonicalPurchase.cost,
			chips: canonicalPurchase.chips,
		});
	});

	it("rejects update when the referenced chip purchase belongs to another session", async () => {
		const { caller, updated } = makeCaller({
			eventType: "purchase_chips",
			eventPayload: {
				sessionChipPurchaseId: canonicalPurchase.id,
				name: canonicalPurchase.name,
				cost: canonicalPurchase.cost,
				chips: canonicalPurchase.chips,
			},
			purchases: [{ ...canonicalPurchase, sessionId: "session-2" }],
		});

		await expect(
			caller.update({ id: "event-1", payload: tamperedPayload })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(updated.session_event).toBeUndefined();
	});

	it("writes the server-side chip-purchase snapshot on update", async () => {
		const { caller, updated } = makeCaller({
			eventType: "purchase_chips",
			eventPayload: {
				sessionChipPurchaseId: canonicalPurchase.id,
				name: canonicalPurchase.name,
				cost: canonicalPurchase.cost,
				chips: canonicalPurchase.chips,
			},
			purchases: [canonicalPurchase],
		});

		await caller.update({ id: "event-1", payload: tamperedPayload });

		expect(parseFirstEventPayload(updated.session_event)).toEqual({
			sessionChipPurchaseId: canonicalPurchase.id,
			name: canonicalPurchase.name,
			cost: canonicalPurchase.cost,
			chips: canonicalPurchase.chips,
		});
	});

	const playerEventTypes = ["player_join", "player_leave"] as const;
	for (const eventType of playerEventTypes) {
		it.each([
			["missing", []],
			["foreign", [{ id: "player-1", userId: "user-2" }]],
		])(`rejects ${eventType} create when playerId is %s`, async (_case, players) => {
			const { caller, inserted } = makeCaller({ players });

			await expect(
				caller.create({
					sessionId,
					eventType,
					occurredAt: occurredAt.getTime() / 1000,
					payload: { playerId: "player-1", isHero: false },
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			expect(inserted.session_event).toBeUndefined();
		});

		it(`accepts ${eventType} create for a player owned by the caller`, async () => {
			const { caller, inserted } = makeCaller({
				players: [{ id: "player-1", userId }],
			});

			await caller.create({
				sessionId,
				eventType,
				occurredAt: occurredAt.getTime() / 1000,
				payload: { playerId: "player-1", isHero: false },
			});

			expect(parseFirstEventPayload(inserted.session_event)).toMatchObject({
				playerId: "player-1",
				isHero: false,
			});
		});

		it(`accepts hero ${eventType} create without a playerId`, async () => {
			const { caller, inserted } = makeCaller({});

			await caller.create({
				sessionId,
				eventType,
				occurredAt: occurredAt.getTime() / 1000,
				payload: { isHero: true },
			});

			expect(parseFirstEventPayload(inserted.session_event)).toEqual({
				isHero: true,
			});
		});

		it(`rejects ${eventType} update with a foreign playerId`, async () => {
			const { caller, updated } = makeCaller({
				eventType,
				eventPayload: { playerId: "player-1", isHero: false },
				players: [{ id: "player-1", userId: "user-2" }],
			});

			await expect(
				caller.update({
					id: "event-1",
					payload: { playerId: "player-1", isHero: false },
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			expect(updated.session_event).toBeUndefined();
		});
	}
});

describe("sessionEvent virtual event scoping", () => {
	const userId = "user-1";
	const sessionId = "session-1";
	const occurredAt = new Date("2026-05-01T12:00:00.000Z");
	const canonicalItem = {
		id: "item-1",
		userId,
		name: "Tournament ticket",
		currencyId: "currency-1",
		unitValue: 1000,
	};
	// A forged payload lying about the item's value (internally consistent so
	// it passes the Zod refine) — the server must overwrite every snapshot
	// field from the authoritative item row.
	const tamperedItemPayload = {
		amount: 2,
		itemId: canonicalItem.id,
		itemName: "Forged",
		count: 2,
		unitValue: 1,
		currencyId: "currency-9",
	};
	const pureVirtualPayload = {
		amount: 500,
		itemId: null,
		itemName: null,
		count: null,
		unitValue: null,
		currencyId: null,
	};

	function makeCaller(options: {
		eventType?: "virtual_buy_in" | "virtual_cash_out" | "memo";
		eventPayload?: Record<string, unknown>;
		items?: Record<string, unknown>[];
	}) {
		const eventType = options.eventType ?? "memo";
		const eventPayload = options.eventPayload ?? {};
		const { db, inserted, updated } = createChainableMockDb({
			select: {
				game_session: [
					{
						id: sessionId,
						userId,
						kind: "cash_game",
						status: "active",
						sessionDate: occurredAt,
						startedAt: occurredAt,
						currencyId: "currency-1",
					},
				],
				session_event: [
					{
						id: "event-1",
						sessionId,
						eventType,
						payload: JSON.stringify(eventPayload),
						occurredAt,
						sortOrder: 0,
					},
				],
				item: options.items ?? [],
			},
		});
		const caller = appRouter.createCaller({
			session: { user: { id: userId } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).sessionEvent;
		return { caller, inserted, updated };
	}

	function parseFirstEventPayload(writes: unknown[] | undefined) {
		const write = writes?.[0] as { payload?: unknown } | undefined;
		if (!write || typeof write.payload !== "string") {
			throw new Error("Expected a session event write with a JSON payload");
		}
		return JSON.parse(write.payload) as unknown;
	}

	const virtualEventTypes = ["virtual_buy_in", "virtual_cash_out"] as const;
	for (const eventType of virtualEventTypes) {
		it.each([
			["missing", []],
			["foreign", [{ ...canonicalItem, userId: "user-2" }]],
		])(`rejects ${eventType} create when the referenced item is %s`, async (_case, items) => {
			const { caller, inserted } = makeCaller({ items });

			await expect(
				caller.create({
					liveCashGameSessionId: sessionId,
					eventType,
					occurredAt: occurredAt.getTime() / 1000,
					payload: tamperedItemPayload,
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			expect(inserted.session_event).toBeUndefined();
		});

		it(`writes the server-side item snapshot on ${eventType} create`, async () => {
			const { caller, inserted } = makeCaller({ items: [canonicalItem] });

			await caller.create({
				liveCashGameSessionId: sessionId,
				eventType,
				occurredAt: occurredAt.getTime() / 1000,
				payload: tamperedItemPayload,
			});

			expect(parseFirstEventPayload(inserted.session_event)).toEqual({
				amount: 2000,
				itemId: canonicalItem.id,
				itemName: canonicalItem.name,
				count: 2,
				unitValue: canonicalItem.unitValue,
				currencyId: canonicalItem.currencyId,
			});
		});

		it(`passes a pure-virtual ${eventType} payload through unchanged`, async () => {
			const { caller, inserted } = makeCaller({});

			await caller.create({
				liveCashGameSessionId: sessionId,
				eventType,
				occurredAt: occurredAt.getTime() / 1000,
				payload: pureVirtualPayload,
			});

			expect(parseFirstEventPayload(inserted.session_event)).toEqual(
				pureVirtualPayload
			);
		});
	}

	it("rejects update with a foreign itemId", async () => {
		const { caller, updated } = makeCaller({
			eventType: "virtual_buy_in",
			eventPayload: pureVirtualPayload,
			items: [{ ...canonicalItem, userId: "user-2" }],
		});

		await expect(
			caller.update({ id: "event-1", payload: tamperedItemPayload })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(updated.session_event).toBeUndefined();
	});

	it("re-snapshots from the authoritative item row on update", async () => {
		const { caller, updated } = makeCaller({
			eventType: "virtual_buy_in",
			eventPayload: pureVirtualPayload,
			items: [canonicalItem],
		});

		await caller.update({ id: "event-1", payload: tamperedItemPayload });

		expect(parseFirstEventPayload(updated.session_event)).toEqual({
			amount: 2000,
			itemId: canonicalItem.id,
			itemName: canonicalItem.name,
			count: 2,
			unitValue: canonicalItem.unitValue,
			currencyId: canonicalItem.currencyId,
		});
	});
});
