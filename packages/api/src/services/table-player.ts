import type { Database } from "@sapphire2/db";
import { entryCash, entryTournament } from "@sapphire2/db/schema/entry";
import { player, playerTag, playerTagLink } from "@sapphire2/db/schema/player";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
	type BatchStatement,
	insertChunks,
	selectInChunks,
} from "../lib/batch";
import {
	validateEntityOwnership,
	validateTagsOwnership,
} from "../lib/ownership";
import { guardStatement } from "../lib/write-guard";
import {
	commitEntryEventChange,
	type EntryEventState,
	loadEntryEventState,
	resolveAppendTarget,
} from "./entry-live-writes";
import { assertLiveEntry, loadEntryRuleFacts } from "./live-entry";
import {
	type FoldedTablePlayer,
	foldTablePlayers,
	type SeatStint,
} from "./table-player-fold";

export const TEMPORARY_PLAYER_NAME = "Anonymous";

type PlayerRow = typeof player.$inferSelect;

export interface TablePlayerOutput {
	id: string;
	isActive: boolean;
	joinedAt: Date;
	leftAt: Date | null;
	player: PlayerRow & {
		tags: { color: string; id: string; name: string }[];
	};
	seatPosition: number | null;
	stints: SeatStint[];
}

export interface TablePlayerWriteResult {
	eventId: string;
	id: string;
	playerId: string;
}

type SeatInput = number | null | undefined;

function badRequest(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

function conflict(message: string): never {
	throw new TRPCError({ code: "CONFLICT", message });
}

export async function listTablePlayers(
	db: Database,
	userId: string,
	input: { activeOnly?: boolean; entryId: string }
): Promise<TablePlayerOutput[]> {
	const state = await loadEntryEventState(db, userId, input.entryId);
	const folded = foldTablePlayers(state.events).filter(
		(item) => !input.activeOnly || item.isActive
	);
	const ids = folded.map((item) => item.playerId);
	const players = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select()
				.from(player)
				.where(and(eq(player.userId, userId), inArray(player.id, chunk))),
		1
	);
	const tags = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select({
					color: playerTag.color,
					id: playerTag.id,
					name: playerTag.name,
					playerId: playerTagLink.playerId,
				})
				.from(playerTagLink)
				.innerJoin(
					playerTag,
					and(
						eq(playerTag.id, playerTagLink.tagId),
						eq(playerTag.userId, playerTagLink.userId)
					)
				)
				.where(
					and(
						eq(playerTagLink.userId, userId),
						inArray(playerTagLink.playerId, chunk)
					)
				)
				.orderBy(asc(playerTagLink.position), asc(playerTag.id)),
		1
	);
	const playersById = new Map(players.map((row) => [row.id, row]));
	return folded.flatMap((item) => {
		const row = playersById.get(item.playerId);
		if (!row) {
			return [];
		}
		return [
			{
				id: item.playerId,
				isActive: item.isActive,
				joinedAt: item.joinedAt,
				leftAt: item.leftAt,
				player: {
					...row,
					tags: tags
						.filter((tag) => tag.playerId === item.playerId)
						.map(({ id, name, color }) => ({ color, id, name })),
				},
				seatPosition: item.seatPosition,
				stints: item.stints,
			},
		];
	});
}

interface TableWrite {
	before?: BatchStatement[];
	entryId: string;
	now: Date;
	playerId: string;
	seatPosition: SeatInput;
	state: EntryEventState;
	type: "player_join" | "player_leave";
	userId: string;
}

async function writeTableEvent(
	db: Database,
	write: TableWrite
): Promise<TablePlayerWriteResult> {
	const { eventIds } = await commitEntryEventChange(db, {
		before: write.before,
		change: {
			events: [
				{
					occurredAt: new Date(Math.floor(write.now.getTime() / 1000) * 1000),
					payload:
						write.type === "player_leave" || write.seatPosition === undefined
							? { playerId: write.playerId }
							: { playerId: write.playerId, seatPosition: write.seatPosition },
					type: write.type,
				},
			],
			op: "append",
		},
		entryId: write.entryId,
		now: write.now,
		state: write.state,
		userId: write.userId,
	});
	return {
		eventId: eventIds[0] ?? "",
		id: write.playerId,
		playerId: write.playerId,
	};
}

function openTable(state: EntryEventState): {
	folded: FoldedTablePlayer[];
	state: EntryEventState;
} {
	assertLiveEntry(state);
	resolveAppendTarget(state, undefined);
	return { folded: foldTablePlayers(state.events), state };
}

async function assertSeatAvailable(
	db: Database,
	userId: string,
	table: { folded: FoldedTablePlayer[]; state: EntryEventState },
	entryId: string,
	playerId: string,
	seatPosition: SeatInput
): Promise<BatchStatement[]> {
	if (seatPosition === null || seatPosition === undefined) {
		return [];
	}
	const { tableSize, ruleVersionId } = await loadEntryRuleFacts(
		db,
		userId,
		entryId,
		table.state.kind
	);
	if (tableSize !== null && seatPosition >= tableSize) {
		badRequest(
			`Seat ${seatPosition} is outside this ${tableSize}-handed table`
		);
	}
	if (
		table.folded.some(
			(item) =>
				item.isActive &&
				item.playerId !== playerId &&
				item.seatPosition === seatPosition
		)
	) {
		conflict(`Seat ${seatPosition} is already taken`);
	}
	const detail = table.state.kind === "cash" ? entryCash : entryTournament;
	const ruleId =
		table.state.kind === "cash"
			? entryCash.cashRuleId
			: entryTournament.tournamentRuleId;
	return [
		guardStatement(
			db,
			"seat-rule",
			sql`EXISTS (
		SELECT 1 FROM ${detail} WHERE ${detail.entryId} = ${entryId}
		AND ${detail.userId} = ${userId} AND ${ruleId} = ${ruleVersionId}
	)`
		),
	];
}

function findActive(
	folded: readonly FoldedTablePlayer[],
	playerId: string
): FoldedTablePlayer | undefined {
	return folded.find((item) => item.playerId === playerId && item.isActive);
}

export async function addTablePlayer(
	db: Database,
	userId: string,
	input: { entryId: string; playerId: string; seatPosition?: number },
	now: Date
): Promise<TablePlayerWriteResult> {
	const state = await loadEntryEventState(db, userId, input.entryId);
	await validateEntityOwnership(db, "player", input.playerId, userId);
	const table = openTable(state);
	if (findActive(table.folded, input.playerId)) {
		conflict("This player is already at the table");
	}
	const seatGuards = await assertSeatAvailable(
		db,
		userId,
		table,
		input.entryId,
		input.playerId,
		input.seatPosition
	);
	return await writeTableEvent(db, {
		before: seatGuards,
		entryId: input.entryId,
		now,
		playerId: input.playerId,
		seatPosition: input.seatPosition,
		state: table.state,
		type: "player_join",
		userId,
	});
}

async function addCreatedPlayer(
	db: Database,
	userId: string,
	input: {
		entryId: string;
		isTemporary: boolean;
		memo: string | null;
		name: string;
		seatPosition?: number;
		tagIds?: string[];
	},
	now: Date
): Promise<TablePlayerWriteResult> {
	const state = await loadEntryEventState(db, userId, input.entryId);
	await validateTagsOwnership(db, playerTag, input.tagIds, userId);
	const table = openTable(state);
	const playerId = crypto.randomUUID();
	const seatGuards = await assertSeatAvailable(
		db,
		userId,
		table,
		input.entryId,
		playerId,
		input.seatPosition
	);
	const links = (input.tagIds ?? []).map((tagId, position) => ({
		playerId,
		position,
		tagId,
		userId,
	}));
	return await writeTableEvent(db, {
		before: [
			...seatGuards,
			db.insert(player).values({
				id: playerId,
				isTemporary: input.isTemporary,
				memo: input.memo,
				name: input.name,
				updatedAt: now,
				userId,
			}),
			...insertChunks(links, (chunk) => db.insert(playerTagLink).values(chunk)),
		],
		entryId: input.entryId,
		now,
		playerId,
		seatPosition: input.seatPosition,
		state: table.state,
		type: "player_join",
		userId,
	});
}

export async function addNewTablePlayer(
	db: Database,
	userId: string,
	input: {
		entryId: string;
		playerMemo?: string;
		playerName: string;
		playerTagIds?: string[];
		seatPosition?: number;
	},
	now: Date
): Promise<TablePlayerWriteResult> {
	return await addCreatedPlayer(
		db,
		userId,
		{
			entryId: input.entryId,
			isTemporary: false,
			memo: input.playerMemo ?? null,
			name: input.playerName,
			seatPosition: input.seatPosition,
			tagIds: input.playerTagIds,
		},
		now
	);
}

export async function addTemporaryTablePlayer(
	db: Database,
	userId: string,
	input: { entryId: string; seatPosition?: number },
	now: Date
): Promise<TablePlayerWriteResult> {
	return await addCreatedPlayer(
		db,
		userId,
		{
			entryId: input.entryId,
			isTemporary: true,
			memo: null,
			name: TEMPORARY_PLAYER_NAME,
			seatPosition: input.seatPosition,
		},
		now
	);
}

export async function updateTablePlayerSeat(
	db: Database,
	userId: string,
	input: { entryId: string; playerId: string; seatPosition: number | null },
	now: Date
): Promise<TablePlayerWriteResult> {
	const state = await loadEntryEventState(db, userId, input.entryId);
	await validateEntityOwnership(db, "player", input.playerId, userId);
	const table = openTable(state);
	if (!findActive(table.folded, input.playerId)) {
		badRequest("This player is not at the table");
	}
	const seatGuards = await assertSeatAvailable(
		db,
		userId,
		table,
		input.entryId,
		input.playerId,
		input.seatPosition
	);
	return await writeTableEvent(db, {
		before: seatGuards,
		entryId: input.entryId,
		now,
		playerId: input.playerId,
		seatPosition: input.seatPosition,
		state: table.state,
		type: "player_join",
		userId,
	});
}

export async function removeTablePlayer(
	db: Database,
	userId: string,
	input: { entryId: string; playerId: string },
	now: Date
): Promise<TablePlayerWriteResult> {
	const state = await loadEntryEventState(db, userId, input.entryId);
	await validateEntityOwnership(db, "player", input.playerId, userId);
	const table = openTable(state);
	if (!findActive(table.folded, input.playerId)) {
		badRequest("This player is not at the table");
	}
	return await writeTableEvent(db, {
		entryId: input.entryId,
		now,
		playerId: input.playerId,
		seatPosition: undefined,
		state: table.state,
		type: "player_leave",
		userId,
	});
}
