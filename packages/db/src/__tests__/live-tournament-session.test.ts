import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { liveTournamentSession } from "../schema/live-tournament-session";

describe("LiveTournamentSession schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.status).toBeDefined();
		expect(columns.startedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.id.primary).toBe(true);
	});

	it("userId and status are not null", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.userId.notNull).toBe(true);
		expect(columns.status.notNull).toBe(true);
	});

	it("startedAt is not null", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.startedAt.notNull).toBe(true);
	});

	it("optional columns are nullable", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.storeId.notNull).toBe(false);
		expect(columns.tournamentId.notNull).toBe(false);
		expect(columns.currencyId.notNull).toBe(false);
		expect(columns.buyIn.notNull).toBe(false);
		expect(columns.entryFee.notNull).toBe(false);
		expect(columns.endedAt.notNull).toBe(false);
		expect(columns.memo.notNull).toBe(false);
	});
});
