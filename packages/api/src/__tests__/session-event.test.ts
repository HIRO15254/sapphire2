import { describe, expect, it, vi } from "vitest";

const PURCHASE_CHIPS_REGEX = /purchase_chips/;

vi.mock("@sapphire2/db", () => ({ db: {} }));

describe("sessionEvent router structure", () => {
	it("sessionEventRouter is defined", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		expect(sessionEventRouter).toBeDefined();
	});

	it("exposes exactly the expected procedure set", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const procedureKeys = Object.keys(sessionEventRouter).filter(
			(k) => k !== "_def" && k !== "createCaller"
		);
		expect(procedureKeys.sort()).toEqual(
			[
				"create",
				"delete",
				"list",
				"update",
				"addPlayer",
				"removePlayer",
				"addTemporaryPlayer",
			].sort()
		);
	});

	it("list is a protected query", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectProtected, expectType } = await import("./test-utils");
		expectProtected(sessionEventRouter.list);
		expectType(sessionEventRouter.list, "query");
	});

	it("create / update / delete are protected mutations", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectProtected, expectType } = await import("./test-utils");
		for (const proc of [
			sessionEventRouter.create,
			sessionEventRouter.update,
			sessionEventRouter.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});

	it("addPlayer / removePlayer / addTemporaryPlayer are protected mutations", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectProtected, expectType } = await import("./test-utils");
		for (const proc of [
			sessionEventRouter.addPlayer,
			sessionEventRouter.removePlayer,
			sessionEventRouter.addTemporaryPlayer,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

// ---------------------------------------------------------------------------
// sessionEvent.list input validation
// ---------------------------------------------------------------------------

describe("sessionEvent.list input validation", () => {
	it("accepts sessionId", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.list, { sessionId: "gs1" });
	});

	it("accepts empty object (runtime will reject)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.list, {});
	});

	it("rejects non-string session id", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.list, {
			sessionId: 123,
		});
	});
});

// ---------------------------------------------------------------------------
// sessionEvent.create input validation
// ---------------------------------------------------------------------------

describe("sessionEvent.create input validation", () => {
	const baseline = {
		sessionId: "gs1",
		eventType: "update_stack",
		payload: { stackAmount: 500 },
	} as const;

	it("accepts a valid event creation payload", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.create, baseline);
	});

	it("accepts all known event types", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		const { ALL_EVENT_TYPES } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		for (const eventType of ALL_EVENT_TYPES) {
			expectAccepts(sessionEventRouter.create, {
				sessionId: "gs1",
				eventType,
				payload: {},
			});
		}
	});

	it("rejects unknown event type", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.create, {
			sessionId: "gs1",
			eventType: "totally_made_up_event",
			payload: {},
		});
	});

	it("accepts optional occurredAt timestamp", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.create, {
			...baseline,
			occurredAt: 1_700_000_000,
		});
	});

	it("rejects non-number occurredAt", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.create, {
			...baseline,
			occurredAt: "2024-01-01",
		});
	});

	it("accepts new purchase_chips payload with chipPurchaseOptionId (string)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.create, {
			sessionId: "gs1",
			eventType: "purchase_chips",
			payload: { chipPurchaseOptionId: "42" },
		});
	});

	it("accepts new update_stack payload with chipPurchaseCounts using option IDs", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.create, {
			sessionId: "gs1",
			eventType: "update_stack",
			payload: {
				stackAmount: 15_000,
				chipPurchaseCounts: [
					{ chipPurchaseOptionId: "1", count: 2 },
					{ chipPurchaseOptionId: "2", count: 1 },
				],
			},
		});
	});

	it("accepts tournament session_start with empty payload", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.create, {
			sessionId: "gs1",
			eventType: "session_start",
			payload: {},
		});
	});

	it("accepts player_join with isHero=true (playerId optional at schema level)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.create, {
			sessionId: "gs1",
			eventType: "player_join",
			payload: { isHero: true, seatPosition: 3 },
		});
	});

	it("accepts player_join with playerId (non-hero)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.create, {
			sessionId: "gs1",
			eventType: "player_join",
			payload: { playerId: "player-1", isHero: false },
		});
	});

	it("accepts player_leave with isHero=true", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.create, {
			sessionId: "gs1",
			eventType: "player_leave",
			payload: { isHero: true },
		});
	});

	it("accepts memo event", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.create, {
			sessionId: "gs1",
			eventType: "memo",
			payload: { text: "hello" },
		});
	});
});

// ---------------------------------------------------------------------------
// sessionEvent.update input validation
// ---------------------------------------------------------------------------

describe("sessionEvent.update input validation", () => {
	it("accepts id-only payload", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.update, { id: "ev1" });
	});

	it("accepts occurredAt update", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.update, {
			id: "ev1",
			occurredAt: 1_700_000_000,
		});
	});

	it("accepts payload replacement", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.update, {
			id: "ev1",
			payload: { stackAmount: 1000 },
		});
	});

	it("rejects missing id", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.update, {
			payload: { stackAmount: 1000 },
		});
	});

	it("rejects non-number occurredAt", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.update, {
			id: "ev1",
			occurredAt: "later",
		});
	});
});

// ---------------------------------------------------------------------------
// sessionEvent.delete input validation
// ---------------------------------------------------------------------------

describe("sessionEvent.delete input validation", () => {
	it("accepts a valid id", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.delete, { id: "ev1" });
	});

	it("rejects missing id", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.delete, {});
	});

	it("rejects non-string id", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.delete, { id: 123 });
	});
});

// ---------------------------------------------------------------------------
// sessionEvent.addPlayer input validation
// ---------------------------------------------------------------------------

describe("sessionEvent.addPlayer input validation", () => {
	it("accepts minimal input with playerId", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.addPlayer, {
			sessionId: "gs1",
			playerId: "player-1",
		});
	});

	it("accepts isHero=true without playerId (schema allows)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.addPlayer, {
			sessionId: "gs1",
			isHero: true,
		});
	});

	it("accepts all optional fields", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.addPlayer, {
			sessionId: "gs1",
			playerId: "player-1",
			isHero: false,
			seatPosition: 3,
			occurredAt: 1_700_000_000,
		});
	});

	it("rejects seatPosition out of range (> 8)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.addPlayer, {
			sessionId: "gs1",
			playerId: "player-1",
			seatPosition: 9,
		});
	});

	it("rejects seatPosition = -1 (below min 0)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.addPlayer, {
			sessionId: "gs1",
			playerId: "player-1",
			seatPosition: -1,
		});
	});

	it("accepts seatPosition = 0 (boundary min)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.addPlayer, {
			sessionId: "gs1",
			playerId: "player-1",
			seatPosition: 0,
		});
	});

	it("accepts seatPosition = 8 (boundary max)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.addPlayer, {
			sessionId: "gs1",
			playerId: "player-1",
			seatPosition: 8,
		});
	});

	it("rejects missing sessionId", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.addPlayer, { playerId: "player-1" });
	});
});

// ---------------------------------------------------------------------------
// sessionEvent.removePlayer input validation
// ---------------------------------------------------------------------------

describe("sessionEvent.removePlayer input validation", () => {
	it("accepts minimal input with playerId", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.removePlayer, {
			sessionId: "gs1",
			playerId: "player-1",
		});
	});

	it("accepts isHero=true without playerId", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.removePlayer, {
			sessionId: "gs1",
			isHero: true,
		});
	});

	it("accepts optional occurredAt", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.removePlayer, {
			sessionId: "gs1",
			playerId: "player-1",
			occurredAt: 1_700_000_000,
		});
	});

	it("rejects missing sessionId", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.removePlayer, {
			playerId: "player-1",
		});
	});

	it("rejects non-boolean isHero", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.removePlayer, {
			sessionId: "gs1",
			isHero: "yes",
		});
	});
});

// ---------------------------------------------------------------------------
// sessionEvent.addTemporaryPlayer input validation
// ---------------------------------------------------------------------------

describe("sessionEvent.addTemporaryPlayer input validation", () => {
	it("accepts minimal input", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.addTemporaryPlayer, {
			sessionId: "gs1",
			name: "Anonymous",
		});
	});

	it("accepts all optional fields", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.addTemporaryPlayer, {
			sessionId: "gs1",
			name: "Temp Player",
			seatPosition: 5,
			occurredAt: 1_700_000_000,
		});
	});

	it("rejects empty name", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.addTemporaryPlayer, {
			sessionId: "gs1",
			name: "",
		});
	});

	it("rejects missing name", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.addTemporaryPlayer, {
			sessionId: "gs1",
		});
	});

	it("rejects missing sessionId", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.addTemporaryPlayer, {
			name: "Temp Player",
		});
	});

	it("rejects seatPosition out of range (> 8)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionEventRouter.addTemporaryPlayer, {
			sessionId: "gs1",
			name: "Player",
			seatPosition: 9,
		});
	});

	it("accepts seatPosition = 0 (boundary min)", async () => {
		const { sessionEventRouter } = await import("../routers/session-event");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionEventRouter.addTemporaryPlayer, {
			sessionId: "gs1",
			name: "Player",
			seatPosition: 0,
		});
	});
});

// ---------------------------------------------------------------------------
// assertEventAllowedForSource — unit tests
// ---------------------------------------------------------------------------

describe("assertEventAllowedForSource", () => {
	it("does not throw for live session", async () => {
		const { assertEventAllowedForSource } = await import(
			"../utils/session-guards"
		);
		expect(() =>
			assertEventAllowedForSource("live", "update_stack")
		).not.toThrow();
	});

	it("throws TRPCError BAD_REQUEST for manual session", async () => {
		const { assertEventAllowedForSource } = await import(
			"../utils/session-guards"
		);
		const { TRPCError } = await import("@trpc/server");
		expect(() => assertEventAllowedForSource("manual", "update_stack")).toThrow(
			TRPCError
		);
	});

	it("throws with BAD_REQUEST code", async () => {
		const { assertEventAllowedForSource } = await import(
			"../utils/session-guards"
		);
		const { TRPCError } = await import("@trpc/server");
		try {
			assertEventAllowedForSource("manual", "player_join");
		} catch (err) {
			expect((err as InstanceType<typeof TRPCError>).code).toBe("BAD_REQUEST");
		}
	});

	it("includes event type in error message for manual session", async () => {
		const { assertEventAllowedForSource } = await import(
			"../utils/session-guards"
		);
		try {
			assertEventAllowedForSource("manual", "purchase_chips");
		} catch (err) {
			expect((err as Error).message).toMatch(PURCHASE_CHIPS_REGEX);
		}
	});

	it("rejects every event type for manual sessions", async () => {
		const { assertEventAllowedForSource } = await import(
			"../utils/session-guards"
		);
		const { ALL_EVENT_TYPES } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		const { TRPCError } = await import("@trpc/server");
		for (const eventType of ALL_EVENT_TYPES) {
			expect(() => assertEventAllowedForSource("manual", eventType)).toThrow(
				TRPCError
			);
		}
	});
});

// ---------------------------------------------------------------------------
// assertLiveSession — unit tests
// ---------------------------------------------------------------------------

describe("assertLiveSession", () => {
	it("does not throw for source='live'", async () => {
		const { assertLiveSession } = await import("../utils/session-guards");
		expect(() => assertLiveSession("live")).not.toThrow();
	});

	it("throws TRPCError for source='manual'", async () => {
		const { assertLiveSession } = await import("../utils/session-guards");
		const { TRPCError } = await import("@trpc/server");
		expect(() => assertLiveSession("manual")).toThrow(TRPCError);
	});

	it("throws with BAD_REQUEST code for manual", async () => {
		const { assertLiveSession } = await import("../utils/session-guards");
		const { TRPCError } = await import("@trpc/server");
		try {
			assertLiveSession("manual");
		} catch (err) {
			expect((err as InstanceType<typeof TRPCError>).code).toBe("BAD_REQUEST");
		}
	});
});

// ---------------------------------------------------------------------------
// New payload schemas — unit tests
// ---------------------------------------------------------------------------

describe("purchaseChipsPayload schema (new: chipPurchaseOptionId)", () => {
	it("accepts valid chipPurchaseOptionId string", async () => {
		const { purchaseChipsPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			purchaseChipsPayload.safeParse({ chipPurchaseOptionId: "42" }).success
		).toBe(true);
	});

	it("rejects empty chipPurchaseOptionId", async () => {
		const { purchaseChipsPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			purchaseChipsPayload.safeParse({ chipPurchaseOptionId: "" }).success
		).toBe(false);
	});

	it("rejects old-style payload with name/cost/chips (no chipPurchaseOptionId)", async () => {
		const { purchaseChipsPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			purchaseChipsPayload.safeParse({ name: "Rebuy", cost: 100, chips: 1000 })
				.success
		).toBe(false);
	});
});

describe("updateStackPayload schema (new: chipPurchaseCounts with option IDs)", () => {
	it("accepts stackAmount-only payload", async () => {
		const { updateStackPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(updateStackPayload.safeParse({ stackAmount: 5000 }).success).toBe(
			true
		);
	});

	it("accepts chipPurchaseCounts with chipPurchaseOptionId", async () => {
		const { updateStackPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			updateStackPayload.safeParse({
				stackAmount: 15_000,
				chipPurchaseCounts: [
					{ chipPurchaseOptionId: "1", count: 2 },
					{ chipPurchaseOptionId: "2", count: 0 },
				],
			}).success
		).toBe(true);
	});

	it("rejects old-style chipPurchaseCounts with name/chipsPerUnit", async () => {
		const { updateStackPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			updateStackPayload.safeParse({
				stackAmount: 10_000,
				chipPurchaseCounts: [{ name: "Rebuy", count: 1, chipsPerUnit: 1000 }],
			}).success
		).toBe(false);
	});

	it("rejects negative count in chipPurchaseCounts", async () => {
		const { updateStackPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			updateStackPayload.safeParse({
				stackAmount: 10_000,
				chipPurchaseCounts: [{ chipPurchaseOptionId: "1", count: -1 }],
			}).success
		).toBe(false);
	});

	it("accepts count = 0 (boundary)", async () => {
		const { updateStackPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			updateStackPayload.safeParse({
				stackAmount: 10_000,
				chipPurchaseCounts: [{ chipPurchaseOptionId: "1", count: 0 }],
			}).success
		).toBe(true);
	});

	it("accepts remainingPlayers and totalEntries (tournament context)", async () => {
		const { updateStackPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			updateStackPayload.safeParse({
				stackAmount: 10_000,
				remainingPlayers: 5,
				totalEntries: 20,
			}).success
		).toBe(true);
	});

	it("rejects stackAmount below 0", async () => {
		const { updateStackPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(updateStackPayload.safeParse({ stackAmount: -1 }).success).toBe(
			false
		);
	});
});

describe("tournamentSessionStartPayload schema (new: empty payload)", () => {
	it("accepts empty object", async () => {
		const { tournamentSessionStartPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(tournamentSessionStartPayload.safeParse({}).success).toBe(true);
	});

	it("accepts extra fields (Zod strips unknown by default)", async () => {
		const { tournamentSessionStartPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			tournamentSessionStartPayload.safeParse({ timerStartedAt: 1_700_000_000 })
				.success
		).toBe(true);
	});
});

describe("playerJoinPayload schema (unchanged)", () => {
	it("accepts { isHero: true } without playerId", async () => {
		const { playerJoinPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(playerJoinPayload.safeParse({ isHero: true }).success).toBe(true);
	});

	it("accepts { playerId, isHero: false }", async () => {
		const { playerJoinPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			playerJoinPayload.safeParse({ playerId: "p1", isHero: false }).success
		).toBe(true);
	});

	it("accepts optional seatPosition 0..8", async () => {
		const { playerJoinPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			playerJoinPayload.safeParse({
				playerId: "p1",
				isHero: false,
				seatPosition: 8,
			}).success
		).toBe(true);
	});

	it("rejects seatPosition > 8", async () => {
		const { playerJoinPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			playerJoinPayload.safeParse({
				playerId: "p1",
				isHero: false,
				seatPosition: 9,
			}).success
		).toBe(false);
	});

	it("defaults isHero to false when omitted", async () => {
		const { playerJoinPayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		const result = playerJoinPayload.safeParse({ playerId: "p1" }) as {
			success: true;
			data: { isHero: boolean };
		};
		expect(result.success).toBe(true);
		expect(result.data.isHero).toBe(false);
	});
});

describe("playerLeavePayload schema (unchanged)", () => {
	it("accepts { isHero: true } without playerId", async () => {
		const { playerLeavePayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(playerLeavePayload.safeParse({ isHero: true }).success).toBe(true);
	});

	it("accepts { playerId, isHero: false }", async () => {
		const { playerLeavePayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		expect(
			playerLeavePayload.safeParse({ playerId: "p1", isHero: false }).success
		).toBe(true);
	});

	it("defaults isHero to false when omitted", async () => {
		const { playerLeavePayload } = await import(
			"@sapphire2/db/constants/session-event-types"
		);
		const result = playerLeavePayload.safeParse({ playerId: "p1" }) as {
			success: true;
			data: { isHero: boolean };
		};
		expect(result.success).toBe(true);
		expect(result.data.isHero).toBe(false);
	});
});
