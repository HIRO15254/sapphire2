import type { Database } from "@sapphire2/db";
import {
	cardListMaxLength,
	HAND_ACTIONS,
	MAX_BOARD_CARDS,
	MAX_HAND_ACTIONS,
	MAX_HAND_BOARDS,
	MAX_HAND_MEMO_LENGTH,
	MAX_HAND_STREET,
	MAX_HAND_TABLE_SIZE,
	MAX_HOLE_CARDS,
	MAX_SEAT_POSITION,
	MIN_HAND_TABLE_SIZE,
} from "@sapphire2/db/constants/hand";
import { playSession } from "@sapphire2/db/schema/entry";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import {
	hand,
	handAction,
	handBoard,
	handSeat,
} from "@sapphire2/db/schema/hand";
import { handTag, handTagLink } from "@sapphire2/db/schema/hand-tag";
import { player } from "@sapphire2/db/schema/player";
import { anteTypeSchema } from "@sapphire2/db/schemas/game";
import { MAX_LINKED_TAGS, tagIdsSchema } from "@sapphire2/db/schemas/tag-ids";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import z from "zod";
import {
	type BatchStatement,
	chunkForInsert,
	runBatch,
	selectInChunks,
} from "../lib/batch";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { isForeignKeyConstraintError } from "../lib/db-errors";
import { instantSchema } from "../lib/instant";
import { validateTagsOwnership } from "../lib/ownership";

export const MAX_HAND_PAGE_SIZE = 50;
export const DEFAULT_HAND_PAGE_SIZE = 20;

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
		blind1: chipsSchema.optional(),
		blind2: chipsSchema.optional(),
		blind3: chipsSchema.optional(),
		ante: chipsSchema.optional(),
		anteType: anteTypeSchema.optional(),
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
	levelOrdinal: z.number().int().min(1).nullable(),
	stakes: handStakesSchema.nullable(),
	variantId: z.string().nullable(),
};

export const handAddInputSchema = z.object({
	playSessionId: z.string(),
	...z.object(handContextFields).partial().shape,
	playedAt: z.number().int().min(0).optional(),
});

const handSummaryFields = {
	boards: z.array(cardListSchema(MAX_BOARD_CARDS)).max(MAX_HAND_BOARDS),
	pot: chipsSchema.nullable(),
	rake: chipsSchema.nullable(),
	memo: z.string().max(MAX_HAND_MEMO_LENGTH).nullable(),
};

const handSeatSchema = z.object({
	seat: seatNumberSchema,
	playerId: z.string().min(1).nullable(),
	startStack: chipsSchema.nullable(),
	holeCards: cardListSchema(MAX_HOLE_CARDS).nullable(),
	net: chipResultSchema.nullable(),
	showed: z.boolean(),
});

const tagReviewsSchema = z
	.array(
		z.object({
			tagId: z.string().min(1),
			reviewedAt: instantSchema.nullable(),
		})
	)
	.max(MAX_LINKED_TAGS)
	.refine(
		(reviews) =>
			new Set(reviews.map(({ tagId }) => tagId)).size === reviews.length,
		{ message: "tagReviews must not repeat a tag" }
	);

const handUpdateFields = {
	id: z.string().min(1),
	...handContextFields,
	tagIds: tagIdsSchema.optional(),
	tagReviews: tagReviewsSchema.optional(),
};

const handActionSchema = z.object({
	street: z.number().int().min(0).max(MAX_HAND_STREET),
	seat: seatNumberSchema,
	action: z.enum(HAND_ACTIONS),
	amount: chipsSchema.nullable(),
	allIn: z.boolean(),
});

function checkShowedCards(
	seat: { holeCards: string | null; showed: boolean },
	ctx: z.RefinementCtx,
	path: (string | number)[]
): void {
	if (seat.showed && seat.holeCards === null) {
		ctx.addIssue({
			code: "custom",
			path: [...path, "holeCards"],
			message: "A shown seat needs its hole cards",
		});
	}
}

export const handUpdateInputSchema = z.discriminatedUnion("detail", [
	z.object({
		...handUpdateFields,
		detail: z.literal("count"),
	}),
	z
		.object({
			...handUpdateFields,
			detail: z.literal("summary"),
			...handSummaryFields,
			hero: handSeatSchema.extend({ playerId: z.string().min(1) }),
		})
		.superRefine((input, ctx) => {
			checkShowedCards(input.hero, ctx, ["hero"]);
		}),
	z
		.object({
			...handUpdateFields,
			detail: z.literal("full"),
			...handSummaryFields,
			seats: z
				.array(handSeatSchema)
				.min(1)
				.max(MAX_SEAT_POSITION + 1),
			actions: z.array(handActionSchema).max(MAX_HAND_ACTIONS),
		})
		.superRefine((input, ctx) => {
			const seats = new Set(input.seats.map(({ seat }) => seat));
			for (const [index, seat] of input.seats.entries()) {
				checkShowedCards(seat, ctx, ["seats", index]);
			}
			if (seats.size !== input.seats.length) {
				ctx.addIssue({
					code: "custom",
					path: ["seats"],
					message: "A seat appears more than once",
				});
			}
			const playerIds = input.seats.flatMap(({ playerId }) =>
				playerId === null ? [] : [playerId]
			);
			if (new Set(playerIds).size !== playerIds.length) {
				ctx.addIssue({
					code: "custom",
					path: ["seats"],
					message: "A player sits in more than one seat",
				});
			}
			const shownSeats = new Set(
				input.seats.filter(({ showed }) => showed).map(({ seat }) => seat)
			);
			for (const [index, action] of input.actions.entries()) {
				if (!seats.has(action.seat)) {
					ctx.addIssue({
						code: "custom",
						path: ["actions", index, "seat"],
						message: "The action's seat is not in the hand",
					});
				} else if (action.action === "show" && !shownSeats.has(action.seat)) {
					ctx.addIssue({
						code: "custom",
						path: ["actions", index, "seat"],
						message: "A seat that shows must be marked as shown",
					});
				}
			}
		}),
]);

export type HandAddInput = z.infer<typeof handAddInputSchema>;
export type HandUpdateInput = z.infer<typeof handUpdateInputSchema>;
export type HandStakes = z.infer<typeof handStakesSchema>;

type HandRow = typeof hand.$inferSelect;
type HandSeatRow = typeof handSeat.$inferSelect;
type HandActionRow = typeof handAction.$inferSelect;

export interface HandTagOutput {
	id: string;
	name: string;
	reviewedAt: Date | null;
}

export type HandOutput = Omit<HandRow, "stakes" | "userId"> & {
	boards: string[];
	stakes: HandStakes | null;
	tags: HandTagOutput[];
};
export type HandSeatOutput = Omit<HandSeatRow, "handId" | "userId">;
export type HandActionOutput = Omit<HandActionRow, "handId" | "userId">;
export type HandDetailOutput = HandOutput & {
	actions: HandActionOutput[];
	seats: HandSeatOutput[];
};

interface OwnedHand {
	detail: HandRow["detail"];
	handNo: number;
	id: string;
	playSessionId: string;
}

function toHandOutput(
	{ stakes, userId: _userId, ...row }: HandRow,
	boards: string[],
	tags: HandTagOutput[]
): HandOutput {
	return {
		...row,
		boards,
		stakes: stakes === null ? null : handStakesSchema.parse(JSON.parse(stakes)),
		tags,
	};
}

const OWNER_SCOPED_CHUNK_EXTRA = 1;

function groupByHand<Row extends { handId: string }, Value>(
	rows: Row[],
	value: (row: Row) => Value
): Map<string, Value[]> {
	const grouped = new Map<string, Value[]>();
	for (const row of rows) {
		const list = grouped.get(row.handId);
		if (list) {
			list.push(value(row));
		} else {
			grouped.set(row.handId, [value(row)]);
		}
	}
	return grouped;
}

async function loadBoards(
	db: Database,
	userId: string,
	handIds: string[]
): Promise<Map<string, string[]>> {
	const rows = await selectInChunks(
		handIds,
		(chunk) =>
			db
				.select({ handId: handBoard.handId, cards: handBoard.cards })
				.from(handBoard)
				.where(
					and(inArray(handBoard.handId, chunk), eq(handBoard.userId, userId))
				)
				.orderBy(asc(handBoard.handId), asc(handBoard.boardNo)),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	return groupByHand(rows, ({ cards }) => cards);
}

async function loadTags(
	db: Database,
	userId: string,
	handIds: string[]
): Promise<Map<string, HandTagOutput[]>> {
	const rows = await selectInChunks(
		handIds,
		(chunk) =>
			db
				.select({
					handId: handTagLink.handId,
					id: handTag.id,
					name: handTag.name,
					reviewedAt: handTagLink.reviewedAt,
				})
				.from(handTagLink)
				.innerJoin(
					handTag,
					and(
						eq(handTag.id, handTagLink.tagId),
						eq(handTag.userId, handTagLink.userId)
					)
				)
				.where(
					and(
						eq(handTagLink.userId, userId),
						inArray(handTagLink.handId, chunk)
					)
				)
				.orderBy(asc(handTag.sortOrder), asc(handTag.id)),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	return groupByHand(rows, ({ handId: _handId, ...tag }) => tag);
}

async function loadSeats(
	db: Database,
	userId: string,
	handIds: string[]
): Promise<Map<string, HandSeatOutput[]>> {
	const rows = await selectInChunks(
		handIds,
		(chunk) =>
			db
				.select()
				.from(handSeat)
				.where(
					and(inArray(handSeat.handId, chunk), eq(handSeat.userId, userId))
				)
				.orderBy(asc(handSeat.handId), asc(handSeat.seat)),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	return groupByHand(
		rows,
		({ handId: _handId, userId: _userId, ...seat }) => seat
	);
}

async function loadActions(
	db: Database,
	userId: string,
	handIds: string[]
): Promise<Map<string, HandActionOutput[]>> {
	const rows = await selectInChunks(
		handIds,
		(chunk) =>
			db
				.select()
				.from(handAction)
				.where(
					and(inArray(handAction.handId, chunk), eq(handAction.userId, userId))
				)
				.orderBy(asc(handAction.handId), asc(handAction.seq)),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	return groupByHand(
		rows,
		({ handId: _handId, userId: _userId, ...action }) => action
	);
}

export async function hydrateHandDetails(
	db: Database,
	userId: string,
	rows: HandRow[]
): Promise<HandDetailOutput[]> {
	const ids = rows.map(({ id }) => id);
	const [boards, tags, seats, actions] = await Promise.all([
		loadBoards(db, userId, ids),
		loadTags(db, userId, ids),
		loadSeats(db, userId, ids),
		loadActions(db, userId, ids),
	]);
	return rows.map((row) => ({
		...toHandOutput(row, boards.get(row.id) ?? [], tags.get(row.id) ?? []),
		seats: seats.get(row.id) ?? [],
		actions: actions.get(row.id) ?? [],
	}));
}

function forbidden(message: string): TRPCError {
	return new TRPCError({ code: "FORBIDDEN", message });
}

async function loadOwnedPlaySessionStatus(
	db: Database,
	userId: string,
	playSessionId: string
): Promise<(typeof playSession.$inferSelect)["status"]> {
	const [found] = await db
		.select({ status: playSession.status })
		.from(playSession)
		.where(
			and(eq(playSession.id, playSessionId), eq(playSession.userId, userId))
		);
	if (!found) {
		throw forbidden("You do not own this play session");
	}
	return found.status;
}

async function assertActivePlaySession(
	db: Database,
	userId: string,
	playSessionId: string
): Promise<void> {
	const status = await loadOwnedPlaySessionStatus(db, userId, playSessionId);
	if (status !== "active") {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Hands can be counted only while the play session is active",
		});
	}
}

async function assertOwnedReferences(
	db: Database,
	userId: string,
	references: { playerIds: string[]; variantId: string | null | undefined }
): Promise<{ selfPlayerId: string | null }> {
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
		return { selfPlayerId: null };
	}
	const owned = await db
		.select({ id: player.id, isSelf: player.isSelf })
		.from(player)
		.where(and(inArray(player.id, playerIds), eq(player.userId, userId)));
	if (owned.length !== playerIds.length) {
		throw forbidden("You do not own this player");
	}
	return { selfPlayerId: owned.find(({ isSelf }) => isSelf)?.id ?? null };
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
			playedAt:
				input.playedAt === undefined ? now : new Date(input.playedAt * 1000),
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

function seatRows(
	userId: string,
	input: HandUpdateInput,
	selfPlayerId: string | null
) {
	if (input.detail === "count") {
		return [];
	}
	const seats = input.detail === "summary" ? [input.hero] : input.seats;
	return seats.map((seat) => ({
		handId: input.id,
		userId,
		seat: seat.seat,
		playerId: seat.playerId,
		isHero: seat.playerId !== null && seat.playerId === selfPlayerId,
		startStack: seat.startStack,
		holeCards: seat.holeCards,
		net: seat.net,
		showed: seat.showed,
	}));
}

function actionRows(userId: string, input: HandUpdateInput) {
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

export interface HandTagLinkPlan {
	reviewedAt: Date | null;
	tagId: string;
}

export interface HandUpdatePlan {
	selfPlayerId: string | null;
	tagLinks: HandTagLinkPlan[] | undefined;
}

function tagLinkStatements(
	db: Database,
	userId: string,
	handId: string,
	tagLinks: HandTagLinkPlan[] | undefined
): BatchStatement[] {
	if (tagLinks === undefined) {
		return [];
	}
	const rows = tagLinks.map(({ tagId, reviewedAt }) => ({
		userId,
		handId,
		tagId,
		reviewedAt,
	}));
	const statements: BatchStatement[] = [
		db
			.delete(handTagLink)
			.where(
				and(eq(handTagLink.handId, handId), eq(handTagLink.userId, userId))
			),
	];
	if (rows[0]) {
		for (const chunk of chunkForInsert(rows, Object.keys(rows[0]).length)) {
			statements.push(db.insert(handTagLink).values(chunk));
		}
	}
	return statements;
}

export function buildHandUpdateStatements(
	db: Database,
	userId: string,
	input: HandUpdateInput,
	plan: HandUpdatePlan,
	now: Date
): BatchStatement[] {
	const summary =
		input.detail === "count"
			? { pot: null, rake: null, memo: null }
			: { pot: input.pot, rake: input.rake, memo: input.memo };
	const boards =
		input.detail === "count"
			? []
			: input.boards.map((cards, index) => ({
					handId: input.id,
					userId,
					boardNo: index + 1,
					cards,
				}));
	const seats = seatRows(userId, input, plan.selfPlayerId);
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
			.delete(handBoard)
			.where(and(eq(handBoard.handId, input.id), eq(handBoard.userId, userId))),
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
	if (boards.length > 0) {
		statements.push(db.insert(handBoard).values(boards));
	}
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
	statements.push(...tagLinkStatements(db, userId, input.id, plan.tagLinks));
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
	await assertActivePlaySession(db, userId, input.playSessionId);
	await assertOwnedReferences(db, userId, {
		playerIds: [],
		variantId: input.variantId,
	});
	const [row] = await buildHandAddStatement(db, userId, input, now);
	if (!row) {
		throw new Error("The hand insert returned no row");
	}
	return toHandOutput(row, [], []);
}

export async function undoLastHand(
	db: Database,
	userId: string,
	playSessionId: string
): Promise<void> {
	await assertActivePlaySession(db, userId, playSessionId);
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
		throw new TRPCError({
			code: "CONFLICT",
			message: "There is no hand to undo",
		});
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
}

async function planTagLinks(
	db: Database,
	userId: string,
	input: HandUpdateInput
): Promise<HandTagLinkPlan[] | undefined> {
	if (input.tagIds === undefined && input.tagReviews === undefined) {
		return;
	}
	await validateTagsOwnership(db, handTag, input.tagIds, userId);
	const current = await db
		.select({ tagId: handTagLink.tagId, reviewedAt: handTagLink.reviewedAt })
		.from(handTagLink)
		.where(
			and(eq(handTagLink.handId, input.id), eq(handTagLink.userId, userId))
		);
	const kept = new Map(
		current.map(({ tagId, reviewedAt }) => [tagId, reviewedAt] as const)
	);
	const tagIds = input.tagIds ?? current.map(({ tagId }) => tagId);
	const attached = new Set(tagIds);
	const reviews = new Map<string, Date | null>();
	for (const { tagId, reviewedAt } of input.tagReviews ?? []) {
		if (!attached.has(tagId)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "A tag review must name a tag attached to the hand",
			});
		}
		reviews.set(
			tagId,
			reviewedAt === null ? null : new Date(reviewedAt * 1000)
		);
	}
	return tagIds.map((tagId) => {
		const review = reviews.get(tagId);
		return {
			tagId,
			reviewedAt: review === undefined ? (kept.get(tagId) ?? null) : review,
		};
	});
}

export async function updateHand(
	db: Database,
	userId: string,
	input: HandUpdateInput,
	now: Date
): Promise<HandDetailOutput> {
	await loadOwnedHand(db, userId, input.id);
	const { selfPlayerId } = await assertOwnedReferences(db, userId, {
		playerIds: seatRows(userId, input, null).flatMap(({ playerId }) =>
			playerId === null ? [] : [playerId]
		),
		variantId: input.variantId,
	});
	if (input.detail === "summary" && input.hero.playerId !== selfPlayerId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"A summary hand's seat is Hero's, so it must name your own player",
		});
	}
	const tagLinks = await planTagLinks(db, userId, input);
	await runBatch(
		db,
		buildHandUpdateStatements(
			db,
			userId,
			input,
			{ selfPlayerId, tagLinks },
			now
		)
	);
	return await getHand(db, userId, input.id);
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

const handCursorSchema = z.object({
	playSessionId: z.string(),
	handNo: z.number().int().min(1),
	id: z.string(),
});

export async function listHands(
	db: Database,
	userId: string,
	input: { cursor?: string; limit: number; playSessionId: string }
): Promise<{
	items: (HandOutput & { seats: HandSeatOutput[] })[];
	nextCursor: string | null;
}> {
	const cursor =
		input.cursor === undefined
			? undefined
			: decodeCursor(input.cursor, handCursorSchema);
	if (cursor && cursor.playSessionId !== input.playSessionId) {
		throw forbidden("This cursor belongs to another hand list");
	}
	await loadOwnedPlaySessionStatus(db, userId, input.playSessionId);
	const pageSize = input.limit;
	const conditions = [
		eq(hand.playSessionId, input.playSessionId),
		eq(hand.userId, userId),
	];
	if (cursor) {
		conditions.push(
			sql`(${hand.handNo}, ${hand.id}) < (${cursor.handNo}, ${cursor.id})`
		);
	}
	const rows = await db
		.select()
		.from(hand)
		.where(and(...conditions))
		.orderBy(desc(hand.handNo), desc(hand.id))
		.limit(pageSize + 1);
	const page = rows.slice(0, pageSize);
	const boundary = rows.length > pageSize ? page.at(-1) : undefined;
	const pageIds = page.map(({ id }) => id);
	const [boards, tags, seats] = await Promise.all([
		loadBoards(db, userId, pageIds),
		loadTags(db, userId, pageIds),
		loadSeats(db, userId, pageIds),
	]);
	return {
		items: page.map((row) => ({
			...toHandOutput(row, boards.get(row.id) ?? [], tags.get(row.id) ?? []),
			seats: seats.get(row.id) ?? [],
		})),
		nextCursor: boundary
			? encodeCursor({
					playSessionId: input.playSessionId,
					handNo: boundary.handNo,
					id: boundary.id,
				})
			: null,
	};
}

export async function getHand(
	db: Database,
	userId: string,
	handId: string
): Promise<HandDetailOutput> {
	const [row] = await db
		.select()
		.from(hand)
		.where(and(eq(hand.id, handId), eq(hand.userId, userId)));
	if (!row) {
		throw forbidden("You do not own this hand");
	}
	const [detail] = await hydrateHandDetails(db, userId, [row]);
	if (!detail) {
		throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
	}
	return detail;
}
