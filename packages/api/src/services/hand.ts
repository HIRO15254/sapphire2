import type { Database } from "@sapphire2/db";
import {
	cardListMaxLength,
	HAND_ACTIONS,
	MAX_BOARD_CARDS,
	MAX_HAND_ACTIONS,
	MAX_HAND_MEMO_LENGTH,
	MAX_HAND_STREET,
	MAX_HAND_TABLE_SIZE,
	MAX_HOLE_CARDS,
	MIN_HAND_TABLE_SIZE,
} from "@sapphire2/db/constants/hand";
import { MAX_SEAT_POSITION } from "@sapphire2/db/constants/session-event-types";
import { playSession } from "@sapphire2/db/schema/entry";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { hand, handAction, handSeat } from "@sapphire2/db/schema/hand";
import { player } from "@sapphire2/db/schema/player";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import z from "zod";
import { type BatchStatement, chunkForInsert, runBatch } from "../lib/batch";
import { isForeignKeyConstraintError } from "../lib/db-errors";

export const MAX_HAND_PAGE_SIZE = 50;

const HAND_NO_SHIFT = 1_000_000;
const CARD_PATTERN = "[2-9TJQKA][shdc]";

function cardListSchema(maxCards: number) {
	return z
		.string()
		.max(cardListMaxLength(maxCards))
		.regex(new RegExp(`^${CARD_PATTERN}(?: ${CARD_PATTERN})*$`))
		.refine((value) => {
			const cards = value.split(" ");
			return new Set(cards).size === cards.length;
		}, "A card appears more than once");
}

const chipsSchema = z.number().int().min(0);
const seatNumberSchema = z.number().int().min(0).max(MAX_SEAT_POSITION);
// NOTE(rule): api-data-integrity.md — a chip result is a signed win or loss.
const chipResultSchema = z.number().int();

export const handStakesSchema = z
	.object({
		sb: chipsSchema.optional(),
		bb: chipsSchema.optional(),
		ante: chipsSchema.optional(),
		straddle: chipsSchema.optional(),
	})
	.strict();

const handContextFields = {
	buttonSeat: seatNumberSchema.nullable(),
	tableSize: z
		.number()
		.int()
		.min(MIN_HAND_TABLE_SIZE)
		.max(MAX_HAND_TABLE_SIZE)
		.nullable(),
	levelOrdinal: z.number().int().min(0).nullable(),
	stakes: handStakesSchema.nullable(),
	variantId: z.string().nullable(),
};

export const handAddInputSchema = z.object({
	playSessionId: z.string(),
	...z.object(handContextFields).partial().shape,
});

const handSummaryFields = {
	board: cardListSchema(MAX_BOARD_CARDS).nullable(),
	pot: chipsSchema.nullable(),
	heroNet: chipResultSchema.nullable(),
	memo: z.string().max(MAX_HAND_MEMO_LENGTH).nullable(),
};

const handSeatSchema = z.object({
	seat: seatNumberSchema,
	playerId: z.string().nullable(),
	isHero: z.boolean(),
	startStack: chipsSchema.nullable(),
	holeCards: cardListSchema(MAX_HOLE_CARDS).nullable(),
	net: chipResultSchema.nullable(),
	showed: z.boolean(),
});

const handActionSchema = z.object({
	street: z.number().int().min(0).max(MAX_HAND_STREET),
	seat: seatNumberSchema,
	action: z.enum(HAND_ACTIONS),
	amount: chipsSchema.nullable(),
	allIn: z.boolean(),
});

export const handSaveInputSchema = z.discriminatedUnion("detail", [
	z.object({
		id: z.string(),
		detail: z.literal("count"),
		...handContextFields,
	}),
	z.object({
		id: z.string(),
		detail: z.literal("summary"),
		...handContextFields,
		...handSummaryFields,
		hero: handSeatSchema.omit({ playerId: true, isHero: true }),
	}),
	z
		.object({
			id: z.string(),
			detail: z.literal("full"),
			...handContextFields,
			...handSummaryFields,
			seats: z
				.array(handSeatSchema)
				.min(1)
				.max(MAX_SEAT_POSITION + 1),
			actions: z.array(handActionSchema).max(MAX_HAND_ACTIONS),
		})
		.superRefine((input, ctx) => {
			const seats = new Set(input.seats.map(({ seat }) => seat));
			if (seats.size !== input.seats.length) {
				ctx.addIssue({
					code: "custom",
					path: ["seats"],
					message: "A seat appears more than once",
				});
			}
			if (input.seats.filter(({ isHero }) => isHero).length > 1) {
				ctx.addIssue({
					code: "custom",
					path: ["seats"],
					message: "Only one seat can be Hero",
				});
			}
			for (const [index, action] of input.actions.entries()) {
				if (!seats.has(action.seat)) {
					ctx.addIssue({
						code: "custom",
						path: ["actions", index, "seat"],
						message: "The action's seat is not in the hand",
					});
				}
			}
		}),
]);

export type HandAddInput = z.infer<typeof handAddInputSchema>;
export type HandSaveInput = z.infer<typeof handSaveInputSchema>;
export type HandStakes = z.infer<typeof handStakesSchema>;

type HandRow = typeof hand.$inferSelect;
type HandSeatRow = typeof handSeat.$inferSelect;
type HandActionRow = typeof handAction.$inferSelect;

export type HandOutput = Omit<HandRow, "stakes" | "userId"> & {
	stakes: HandStakes | null;
};
export type HandSeatOutput = Omit<HandSeatRow, "handId" | "userId">;
export type HandActionOutput = Omit<HandActionRow, "handId" | "userId">;

interface OwnedHand {
	detail: HandRow["detail"];
	handNo: number;
	id: string;
	playSessionId: string;
}

function toHandOutput({
	stakes,
	userId: _userId,
	...row
}: HandRow): HandOutput {
	return {
		...row,
		stakes: stakes === null ? null : handStakesSchema.parse(JSON.parse(stakes)),
	};
}

function forbidden(message: string): TRPCError {
	return new TRPCError({ code: "FORBIDDEN", message });
}

async function assertOwnedPlaySession(
	db: Database,
	userId: string,
	playSessionId: string
): Promise<void> {
	const [found] = await db
		.select({ id: playSession.id })
		.from(playSession)
		.where(
			and(eq(playSession.id, playSessionId), eq(playSession.userId, userId))
		);
	if (!found) {
		throw forbidden("You do not own this play session");
	}
}

async function assertOwnedReferences(
	db: Database,
	userId: string,
	references: { playerIds: string[]; variantId: string | null | undefined }
): Promise<void> {
	if (references.variantId) {
		const [found] = await db
			.select({ id: gameVariant.id })
			.from(gameVariant)
			.where(
				and(
					eq(gameVariant.id, references.variantId),
					eq(gameVariant.userId, userId)
				)
			);
		if (!found) {
			throw forbidden("You do not own this game variant");
		}
	}
	const playerIds = [...new Set(references.playerIds)];
	if (playerIds.length === 0) {
		return;
	}
	const owned = await db
		.select({ id: player.id })
		.from(player)
		.where(and(inArray(player.id, playerIds), eq(player.userId, userId)));
	if (owned.length !== playerIds.length) {
		throw forbidden("You do not own this player");
	}
}

async function loadOwnedHand(
	db: Database,
	userId: string,
	handId: string
): Promise<OwnedHand> {
	const [found] = await db
		.select({
			id: hand.id,
			playSessionId: hand.playSessionId,
			handNo: hand.handNo,
			detail: hand.detail,
		})
		.from(hand)
		.where(and(eq(hand.id, handId), eq(hand.userId, userId)));
	if (!found) {
		throw forbidden("You do not own this hand");
	}
	return found;
}

function linkedHandConflict(error: unknown): unknown {
	if (isForeignKeyConstraintError(error)) {
		return new TRPCError({
			code: "CONFLICT",
			message: "This hand is linked to an all-in event",
		});
	}
	return error;
}

export function buildHandAddStatement(
	db: Database,
	userId: string,
	input: HandAddInput,
	now: Date
) {
	return db
		.insert(hand)
		.values({
			id: crypto.randomUUID(),
			userId,
			playSessionId: input.playSessionId,
			handNo: sql`(SELECT COALESCE(MAX(${hand.handNo}), 0) + 1 FROM ${hand} WHERE ${hand.playSessionId} = ${input.playSessionId})`,
			playedAt: now,
			detail: "count",
			buttonSeat: input.buttonSeat ?? null,
			tableSize: input.tableSize ?? null,
			levelOrdinal: input.levelOrdinal ?? null,
			stakes: input.stakes ? JSON.stringify(input.stakes) : null,
			variantId: input.variantId ?? null,
			updatedAt: now,
		})
		.returning();
}

function seatRows(userId: string, input: HandSaveInput) {
	if (input.detail === "count") {
		return [];
	}
	const seats =
		input.detail === "summary"
			? [{ ...input.hero, playerId: null, isHero: true }]
			: input.seats;
	return seats.map((seat) => ({
		handId: input.id,
		userId,
		seat: seat.seat,
		playerId: seat.playerId,
		isHero: seat.isHero,
		startStack: seat.startStack,
		holeCards: seat.holeCards,
		net: seat.net,
		showed: seat.showed,
	}));
}

function actionRows(userId: string, input: HandSaveInput) {
	if (input.detail !== "full") {
		return [];
	}
	return input.actions.map((action, index) => ({
		handId: input.id,
		userId,
		seq: index + 1,
		street: action.street,
		seat: action.seat,
		action: action.action,
		amount: action.amount,
		allIn: action.allIn,
	}));
}

export function buildHandSaveStatements(
	db: Database,
	userId: string,
	input: HandSaveInput,
	now: Date
): BatchStatement[] {
	const summary =
		input.detail === "count"
			? { board: null, pot: null, heroNet: null, memo: null }
			: {
					board: input.board,
					pot: input.pot,
					heroNet: input.heroNet,
					memo: input.memo,
				};
	const seats = seatRows(userId, input);
	const actions = actionRows(userId, input);
	const statements: BatchStatement[] = [
		db
			.delete(handAction)
			.where(
				and(eq(handAction.handId, input.id), eq(handAction.userId, userId))
			),
		db
			.delete(handSeat)
			.where(and(eq(handSeat.handId, input.id), eq(handSeat.userId, userId))),
		db
			.update(hand)
			.set({
				detail: input.detail,
				buttonSeat: input.buttonSeat,
				tableSize: input.tableSize,
				levelOrdinal: input.levelOrdinal,
				stakes: input.stakes ? JSON.stringify(input.stakes) : null,
				variantId: input.variantId,
				...summary,
				updatedAt: now,
			})
			.where(and(eq(hand.id, input.id), eq(hand.userId, userId))),
	];
	if (seats[0]) {
		for (const chunk of chunkForInsert(seats, Object.keys(seats[0]).length)) {
			statements.push(db.insert(handSeat).values(chunk));
		}
	}
	if (actions[0]) {
		for (const chunk of chunkForInsert(
			actions,
			Object.keys(actions[0]).length
		)) {
			statements.push(db.insert(handAction).values(chunk));
		}
	}
	return statements;
}

export function buildHandDeleteStatements(
	db: Database,
	userId: string,
	target: Pick<OwnedHand, "handNo" | "id" | "playSessionId">
): BatchStatement[] {
	const sameSession = and(
		eq(hand.playSessionId, target.playSessionId),
		eq(hand.userId, userId)
	);
	return [
		db.delete(hand).where(and(eq(hand.id, target.id), eq(hand.userId, userId))),
		db
			.update(hand)
			.set({ handNo: sql`${hand.handNo} + ${HAND_NO_SHIFT}` })
			.where(and(sameSession, gt(hand.handNo, target.handNo))),
		db
			.update(hand)
			.set({ handNo: sql`${hand.handNo} - ${HAND_NO_SHIFT + 1}` })
			.where(and(sameSession, gt(hand.handNo, HAND_NO_SHIFT))),
	];
}

export async function addHand(
	db: Database,
	userId: string,
	input: HandAddInput,
	now: Date
): Promise<HandOutput> {
	await assertOwnedPlaySession(db, userId, input.playSessionId);
	await assertOwnedReferences(db, userId, {
		playerIds: [],
		variantId: input.variantId,
	});
	const [row] = await buildHandAddStatement(db, userId, input, now);
	if (!row) {
		throw new Error("The hand insert returned no row");
	}
	return toHandOutput(row);
}

export async function undoLastHand(
	db: Database,
	userId: string,
	playSessionId: string
): Promise<{ handNo: number; id: string } | null> {
	await assertOwnedPlaySession(db, userId, playSessionId);
	const [last] = await db
		.select({
			id: hand.id,
			playSessionId: hand.playSessionId,
			handNo: hand.handNo,
			detail: hand.detail,
		})
		.from(hand)
		.where(and(eq(hand.playSessionId, playSessionId), eq(hand.userId, userId)))
		.orderBy(desc(hand.handNo))
		.limit(1);
	if (!last) {
		return null;
	}
	if (last.detail !== "count") {
		throw new TRPCError({
			code: "CONFLICT",
			message: "The last hand has details. Delete it from the hand list",
		});
	}
	try {
		await runBatch(db, buildHandDeleteStatements(db, userId, last));
	} catch (error) {
		throw linkedHandConflict(error);
	}
	return { id: last.id, handNo: last.handNo };
}

export async function saveHand(
	db: Database,
	userId: string,
	input: HandSaveInput,
	now: Date
): Promise<void> {
	await loadOwnedHand(db, userId, input.id);
	await assertOwnedReferences(db, userId, {
		playerIds:
			input.detail === "full"
				? input.seats.flatMap(({ playerId }) => (playerId ? [playerId] : []))
				: [],
		variantId: input.variantId,
	});
	await runBatch(db, buildHandSaveStatements(db, userId, input, now));
}

export async function deleteHand(
	db: Database,
	userId: string,
	handId: string
): Promise<void> {
	const target = await loadOwnedHand(db, userId, handId);
	try {
		await runBatch(db, buildHandDeleteStatements(db, userId, target));
	} catch (error) {
		throw linkedHandConflict(error);
	}
}

export async function listHands(
	db: Database,
	userId: string,
	input: { cursor?: number; limit: number; playSessionId: string }
): Promise<{
	items: (HandOutput & { seats: HandSeatOutput[] })[];
	nextCursor: number | undefined;
}> {
	await assertOwnedPlaySession(db, userId, input.playSessionId);
	const pageSize = Math.min(input.limit, MAX_HAND_PAGE_SIZE);
	const conditions = [
		eq(hand.playSessionId, input.playSessionId),
		eq(hand.userId, userId),
	];
	if (input.cursor !== undefined) {
		conditions.push(lt(hand.handNo, input.cursor));
	}
	const rows = await db
		.select()
		.from(hand)
		.where(and(...conditions))
		.orderBy(desc(hand.handNo))
		.limit(pageSize + 1);
	const page = rows.slice(0, pageSize);
	const seats =
		page.length === 0
			? []
			: await db
					.select()
					.from(handSeat)
					.where(
						and(
							inArray(
								handSeat.handId,
								page.map(({ id }) => id)
							),
							eq(handSeat.userId, userId)
						)
					)
					.orderBy(asc(handSeat.seat));
	return {
		items: page.map((row) => ({
			...toHandOutput(row),
			seats: seats
				.filter((seat) => seat.handId === row.id)
				.map(({ handId: _handId, userId: _userId, ...seat }) => seat),
		})),
		nextCursor: rows.length > pageSize ? page.at(-1)?.handNo : undefined,
	};
}

export async function getHand(
	db: Database,
	userId: string,
	handId: string
): Promise<
	HandOutput & { actions: HandActionOutput[]; seats: HandSeatOutput[] }
> {
	const [row] = await db
		.select()
		.from(hand)
		.where(and(eq(hand.id, handId), eq(hand.userId, userId)));
	if (!row) {
		throw forbidden("You do not own this hand");
	}
	const seats = await db
		.select()
		.from(handSeat)
		.where(and(eq(handSeat.handId, handId), eq(handSeat.userId, userId)))
		.orderBy(asc(handSeat.seat));
	const actions = await db
		.select()
		.from(handAction)
		.where(and(eq(handAction.handId, handId), eq(handAction.userId, userId)))
		.orderBy(asc(handAction.seq));
	return {
		...toHandOutput(row),
		seats: seats.map(({ handId: _handId, userId: _userId, ...seat }) => seat),
		actions: actions.map(
			({ handId: _handId, userId: _userId, ...action }) => action
		),
	};
}
