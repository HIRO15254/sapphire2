import { ALL_EVENT_TYPES } from "@sapphire2/db/constants/session-event-types";
import { describe, it } from "vitest";
import { appRouter } from "../routers";
import { expectAccepts, expectRejects } from "./test-utils";

describe("sessionEvent.list input validation", () => {
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

	it("accepts explicit play session selection", () => {
		expectAccepts(appRouter.sessionEvent.create, {
			...baseline,
			playSessionId: "play-2",
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
