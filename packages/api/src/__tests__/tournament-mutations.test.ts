import { describe, expect, it } from "vitest";
import { createCaller } from "./caller";
import { DEFAULT_CALLER_USER_ID } from "./test-utils";

const ROOM_ID = "room-1";
const TOURNAMENT_ID = "tn-1";

function ownedTournamentFixture(extra: Record<string, unknown> = {}) {
	return {
		room: [{ id: ROOM_ID, userId: DEFAULT_CALLER_USER_ID }],
		tournament: [{ id: TOURNAMENT_ID, roomId: ROOM_ID }],
		...extra,
	};
}

describe("tournament.listByRoom child hydration", () => {
	it("counts blind levels sharing the same tournament", async () => {
		const { caller } = createCaller({
			select: ownedTournamentFixture({
				blind_level: [
					{ id: "level-1", tournamentId: TOURNAMENT_ID },
					{ id: "level-2", tournamentId: TOURNAMENT_ID },
				],
			}),
		});

		const result = await caller.tournament.listByRoom({ roomId: ROOM_ID });

		expect(result[0]?.blindLevelCount).toBe(2);
	});

	it("returns empty child collections for a tournament with no blind levels, tags, or chip purchases", async () => {
		const { caller } = createCaller({
			select: ownedTournamentFixture(),
		});

		const result = await caller.tournament.listByRoom({ roomId: ROOM_ID });

		expect(result[0]).toMatchObject({
			blindLevelCount: 0,
			tags: [],
			chipPurchases: [],
		});
	});
});

describe("tournament.getById tag mapping", () => {
	it("maps tournament_tag rows to {id, name}", async () => {
		const { caller } = createCaller({
			select: ownedTournamentFixture({
				tournament_tag: [
					{
						id: "tag-1",
						tournamentId: TOURNAMENT_ID,
						name: "Day 1",
						createdAt: new Date(),
					},
				],
			}),
		});

		const result = await caller.tournament.getById({ id: TOURNAMENT_ID });

		expect(result.tags).toEqual([{ id: "tag-1", name: "Day 1" }]);
	});
});

describe("tournament.update field pass-through", () => {
	it("writes every provided field to the update statement", async () => {
		const { caller, updated } = createCaller({
			select: ownedTournamentFixture({
				currency: [{ id: "cur-1", userId: DEFAULT_CALLER_USER_ID }],
			}),
		});

		await caller.tournament.update({
			id: TOURNAMENT_ID,
			name: "Main Event",
			variant: "PLO",
			buyIn: 100,
			entryFee: 20,
			startingStack: 20_000,
			bountyAmount: 50,
			tableSize: 9,
			currencyId: "cur-1",
			memo: "notes",
		});

		expect(updated.tournament[0]).toMatchObject({
			name: "Main Event",
			variant: "PLO",
			buyIn: 100,
			entryFee: 20,
			startingStack: 20_000,
			bountyAmount: 50,
			tableSize: 9,
			currencyId: "cur-1",
			memo: "notes",
		});
	});
});

describe("tournament archive / restore / delete", () => {
	it("archive sets archivedAt to a Date", async () => {
		const { caller, updated } = createCaller({
			select: ownedTournamentFixture(),
		});

		await caller.tournament.archive({ id: TOURNAMENT_ID });

		expect(updated.tournament[0]?.archivedAt).toBeInstanceOf(Date);
	});

	it("restore clears archivedAt to null", async () => {
		const { caller, updated } = createCaller({
			select: ownedTournamentFixture(),
		});

		await caller.tournament.restore({ id: TOURNAMENT_ID });

		expect(updated.tournament[0]).toMatchObject({ archivedAt: null });
	});

	it("delete removes the tournament by id and returns success", async () => {
		const { caller, deleteWhereParams } = createCaller({
			select: ownedTournamentFixture(),
		});

		const result = await caller.tournament.delete({ id: TOURNAMENT_ID });

		expect(result).toEqual({ success: true });
		expect(deleteWhereParams[0]).toContain(TOURNAMENT_ID);
	});
});

describe("tournament.updateWithLevels field pass-through", () => {
	it("writes every provided field to the update statement", async () => {
		const { caller, updated } = createCaller({
			select: ownedTournamentFixture({
				currency: [{ id: "cur-1", userId: DEFAULT_CALLER_USER_ID }],
			}),
		});

		await caller.tournament.updateWithLevels({
			id: TOURNAMENT_ID,
			name: "Main Event",
			variant: "PLO",
			buyIn: 100,
			entryFee: 20,
			startingStack: 20_000,
			bountyAmount: 50,
			tableSize: 9,
			currencyId: "cur-1",
			memo: "notes",
			blindLevels: [],
		});

		expect(updated.tournament[0]).toMatchObject({
			name: "Main Event",
			variant: "PLO",
			buyIn: 100,
			entryFee: 20,
			startingStack: 20_000,
			bountyAmount: 50,
			tableSize: 9,
			currencyId: "cur-1",
			memo: "notes",
		});
	});
});

describe("tournament tags", () => {
	it("addTag inserts a tag scoped to the tournament", async () => {
		const { caller, inserted } = createCaller({
			select: ownedTournamentFixture(),
		});

		await caller.tournament.addTag({
			tournamentId: TOURNAMENT_ID,
			name: "Day 1",
		});

		expect(inserted.tournament_tag[0]).toMatchObject({
			tournamentId: TOURNAMENT_ID,
			name: "Day 1",
		});
	});

	it("removeTag deletes an owned tag and returns success", async () => {
		const { caller } = createCaller({
			select: ownedTournamentFixture({
				tournament_tag: [{ id: "tag-1", tournamentId: TOURNAMENT_ID }],
			}),
		});

		const result = await caller.tournament.removeTag({ id: "tag-1" });

		expect(result).toEqual({ success: true });
	});
});
