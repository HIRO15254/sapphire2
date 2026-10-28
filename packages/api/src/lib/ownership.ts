import { asset } from "@sapphire2/db/schema/asset";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { hand } from "@sapphire2/db/schema/hand";
import {
	assetRate,
	ledgerCategory,
	ledgerLine,
} from "@sapphire2/db/schema/ledger";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { protectedProcedure } from "../index";
import { selectInChunks } from "./batch";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

async function assertRoomOwnedBy(
	db: DbInstance,
	roomId: string,
	userId: string,
	forbiddenMessage: string
): Promise<void> {
	const [foundRoom] = await db.select().from(room).where(eq(room.id, roomId));
	if (!foundRoom || foundRoom.userId !== userId) {
		throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
	}
}

async function validateRingGameOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof ringGame.$inferSelect> {
	const [found] = await db
		.select()
		.from(ringGame)
		.where(eq(ringGame.id, entityId));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
	}
	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
	}
	return found;
}

async function validateRoomOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof room.$inferSelect> {
	const [found] = await db.select().from(room).where(eq(room.id, entityId));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this room",
		});
	}
	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this room",
		});
	}
	return found;
}

async function validateTournamentOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof tournament.$inferSelect> {
	const [found] = await db
		.select()
		.from(tournament)
		.where(eq(tournament.id, entityId));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this tournament",
		});
	}
	await assertRoomOwnedBy(
		db,
		found.roomId,
		userId,
		"You do not own this tournament"
	);
	return found;
}

async function validateCurrencyOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof asset.$inferSelect> {
	const [found] = await db.select().from(asset).where(eq(asset.id, entityId));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this currency",
		});
	}
	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this currency",
		});
	}
	return found;
}

async function validateGameGroupOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof gameGroup.$inferSelect> {
	const [found] = await db
		.select()
		.from(gameGroup)
		.where(eq(gameGroup.id, entityId));
	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this game group",
		});
	}
	return found;
}

async function validateGameVariantOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof gameVariant.$inferSelect> {
	const [found] = await db
		.select()
		.from(gameVariant)
		.where(eq(gameVariant.id, entityId));
	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this game variant",
		});
	}
	return found;
}

async function validateGameMixOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof gameMix.$inferSelect> {
	const [found] = await db
		.select()
		.from(gameMix)
		.where(eq(gameMix.id, entityId));
	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this mix",
		});
	}
	return found;
}

async function validateHandOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof hand.$inferSelect> {
	const [found] = await db.select().from(hand).where(eq(hand.id, entityId));
	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this hand",
		});
	}
	return found;
}

const LEDGER_ENTITY_FORBIDDEN_MESSAGES = {
	asset: "You do not own this asset",
	assetRate: "You do not own this rate",
	ledgerCategory: "You do not own this category",
	ledgerLine: "You do not own this transaction",
} as const;

async function findOwnedLedgerEntity(
	db: DbInstance,
	entityType: keyof typeof LEDGER_ENTITY_FORBIDDEN_MESSAGES,
	entityId: string,
	userId: string
) {
	switch (entityType) {
		case "asset":
			return (
				await db
					.select()
					.from(asset)
					.where(and(eq(asset.id, entityId), eq(asset.userId, userId)))
			)[0];
		case "assetRate":
			return (
				await db
					.select()
					.from(assetRate)
					.where(and(eq(assetRate.id, entityId), eq(assetRate.userId, userId)))
			)[0];
		case "ledgerCategory":
			return (
				await db
					.select()
					.from(ledgerCategory)
					.where(
						and(
							eq(ledgerCategory.id, entityId),
							eq(ledgerCategory.userId, userId)
						)
					)
			)[0];
		default:
			return (
				await db
					.select()
					.from(ledgerLine)
					.where(
						and(eq(ledgerLine.id, entityId), eq(ledgerLine.userId, userId))
					)
			)[0];
	}
}

async function validateLedgerOwnershipBranch(
	db: DbInstance,
	entityType: keyof typeof LEDGER_ENTITY_FORBIDDEN_MESSAGES,
	entityId: string,
	userId: string
) {
	const found = await findOwnedLedgerEntity(db, entityType, entityId, userId);
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: LEDGER_ENTITY_FORBIDDEN_MESSAGES[entityType],
		});
	}
	return found;
}

async function validateEntityOwnership(
	db: DbInstance,
	entityType: "assetRate",
	entityId: string,
	userId: string
): Promise<typeof assetRate.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "ledgerCategory",
	entityId: string,
	userId: string
): Promise<typeof ledgerCategory.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "ledgerLine",
	entityId: string,
	userId: string
): Promise<typeof ledgerLine.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "gameGroup",
	entityId: string,
	userId: string
): Promise<typeof gameGroup.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "gameMix",
	entityId: string,
	userId: string
): Promise<typeof gameMix.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "gameVariant",
	entityId: string,
	userId: string
): Promise<typeof gameVariant.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "hand",
	entityId: string,
	userId: string
): Promise<typeof hand.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "currency" | "asset",
	entityId: string,
	userId: string
): Promise<typeof asset.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "ringGame",
	entityId: string,
	userId: string
): Promise<typeof ringGame.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "room",
	entityId: string,
	userId: string
): Promise<typeof room.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "tournament",
	entityId: string,
	userId: string
): Promise<typeof tournament.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType:
		| keyof typeof LEDGER_ENTITY_FORBIDDEN_MESSAGES
		| "currency"
		| "gameGroup"
		| "gameMix"
		| "gameVariant"
		| "hand"
		| "ringGame"
		| "room"
		| "tournament",
	entityId: string,
	userId: string
): Promise<unknown> {
	switch (entityType) {
		case "room":
			return await validateRoomOwnershipBranch(db, entityId, userId);
		case "ringGame":
			return await validateRingGameOwnershipBranch(db, entityId, userId);
		case "tournament":
			return await validateTournamentOwnershipBranch(db, entityId, userId);
		case "currency":
			return await validateCurrencyOwnershipBranch(db, entityId, userId);
		case "gameGroup":
			return await validateGameGroupOwnershipBranch(db, entityId, userId);
		case "gameVariant":
			return await validateGameVariantOwnershipBranch(db, entityId, userId);
		case "gameMix":
			return await validateGameMixOwnershipBranch(db, entityId, userId);
		case "hand":
			return await validateHandOwnershipBranch(db, entityId, userId);
		case "asset":
		case "assetRate":
		case "ledgerCategory":
		case "ledgerLine":
			return await validateLedgerOwnershipBranch(
				db,
				entityType,
				entityId,
				userId
			);
		default:
			return undefined;
	}
}

export async function validateTagsOwnership(
	db: DbInstance,
	table: SQLiteTable & { id: SQLiteColumn; userId: SQLiteColumn },
	ids: string[] | undefined,
	userId: string
): Promise<void> {
	if (!ids || ids.length === 0) {
		return;
	}
	const uniqueIds = [...new Set(ids)];
	const owned = await selectInChunks(
		uniqueIds,
		(chunk) =>
			db
				.select({ id: table.id })
				.from(table)
				.where(and(inArray(table.id, chunk), eq(table.userId, userId))),
		1
	);
	if (owned.length !== uniqueIds.length) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own one or more of these tags",
		});
	}
}

export { validateEntityOwnership };
