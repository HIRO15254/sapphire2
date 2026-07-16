import { describe, it } from "vitest";
import { appRouter } from "../routers";
import { expectAccepts, expectRejects } from "./test-utils";

const cashSession = {
	type: "cash_game",
	sessionDate: 1_700_000_000,
	buyIn: 1000,
	cashOut: 2000,
} as const;
const tournamentSession = {
	type: "tournament",
	sessionDate: 1_700_000_000,
	tournamentBuyIn: 10_000,
} as const;

describe("foreign-key id input validation", () => {
	it.each([
		["session cash roomId", appRouter.session.create, cashSession, "roomId"],
		[
			"session cash ringGameId",
			appRouter.session.create,
			cashSession,
			"ringGameId",
		],
		[
			"session cash currencyId",
			appRouter.session.create,
			cashSession,
			"currencyId",
		],
		[
			"session tournament roomId",
			appRouter.session.create,
			tournamentSession,
			"roomId",
		],
		[
			"session tournament tournamentId",
			appRouter.session.create,
			tournamentSession,
			"tournamentId",
		],
		[
			"session tournament currencyId",
			appRouter.session.create,
			tournamentSession,
			"currencyId",
		],
		[
			"live cash roomId",
			appRouter.liveCashGameSession.create,
			{ initialBuyIn: 0 },
			"roomId",
		],
		[
			"live cash ringGameId",
			appRouter.liveCashGameSession.create,
			{ initialBuyIn: 0 },
			"ringGameId",
		],
		[
			"live cash currencyId",
			appRouter.liveCashGameSession.create,
			{ initialBuyIn: 0 },
			"currencyId",
		],
		[
			"live tournament roomId",
			appRouter.liveTournamentSession.create,
			{},
			"roomId",
		],
		[
			"live tournament tournamentId",
			appRouter.liveTournamentSession.create,
			{},
			"tournamentId",
		],
		[
			"live tournament currencyId",
			appRouter.liveTournamentSession.create,
			{},
			"currencyId",
		],
		[
			"ring game currencyId",
			appRouter.ringGame.create,
			{ roomId: "room-1", name: "Game" },
			"currencyId",
		],
		[
			"tournament currencyId",
			appRouter.tournament.create,
			{ roomId: "room-1", name: "Tournament" },
			"currencyId",
		],
		[
			"tournament with levels currencyId",
			appRouter.tournament.createWithLevels,
			{ roomId: "room-1", name: "Tournament" },
			"currencyId",
		],
	] as const)("rejects an empty %s while accepting a non-empty id and undefined", (_label, procedure, base, field) => {
		expectRejects(procedure, { ...base, [field]: "" });
		expectAccepts(procedure, { ...base, [field]: "linked-id" });
		expectAccepts(procedure, { ...base, [field]: undefined });
	});

	it.each([
		["session roomId", appRouter.session.update, "roomId"],
		["session ringGameId", appRouter.session.update, "ringGameId"],
		["session tournamentId", appRouter.session.update, "tournamentId"],
		["session currencyId", appRouter.session.update, "currencyId"],
		["live cash roomId", appRouter.liveCashGameSession.update, "roomId"],
		[
			"live cash ringGameId",
			appRouter.liveCashGameSession.update,
			"ringGameId",
		],
		[
			"live cash currencyId",
			appRouter.liveCashGameSession.update,
			"currencyId",
		],
		[
			"live tournament roomId",
			appRouter.liveTournamentSession.update,
			"roomId",
		],
		[
			"live tournament tournamentId",
			appRouter.liveTournamentSession.update,
			"tournamentId",
		],
		[
			"live tournament currencyId",
			appRouter.liveTournamentSession.update,
			"currencyId",
		],
		["ring game currencyId", appRouter.ringGame.update, "currencyId"],
		["tournament currencyId", appRouter.tournament.update, "currencyId"],
		[
			"tournament with levels currencyId",
			appRouter.tournament.updateWithLevels,
			"currencyId",
		],
	] as const)("rejects an empty %s while accepting a non-empty id, null clear, and undefined", (_label, procedure, field) => {
		const base =
			procedure === appRouter.tournament.updateWithLevels
				? { id: "id-1", blindLevels: [] }
				: { id: "id-1" };
		expectRejects(procedure, { ...base, [field]: "" });
		expectAccepts(procedure, { ...base, [field]: "linked-id" });
		expectAccepts(procedure, { ...base, [field]: null });
		expectAccepts(procedure, { ...base, [field]: undefined });
	});
});

describe("live tournament completion placement validation", () => {
	const base = {
		id: "session-1",
		beforeDeadline: false,
		prizeMoney: 0,
		bountyPrizes: 0,
	} as const;

	it("rejects placement greater than totalEntries", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			...base,
			placement: 11,
			totalEntries: 10,
		});
	});

	it("accepts placement equal to totalEntries", () => {
		expectAccepts(appRouter.liveTournamentSession.complete, {
			...base,
			placement: 10,
			totalEntries: 10,
		});
	});

	it("accepts the one-player boundary", () => {
		expectAccepts(appRouter.liveTournamentSession.complete, {
			...base,
			placement: 1,
			totalEntries: 1,
		});
	});
});
