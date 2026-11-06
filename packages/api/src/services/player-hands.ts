import type { Database } from "@sapphire2/db";
import type { HandAction } from "@sapphire2/db/constants/hand";
import { playSession } from "@sapphire2/db/schema/entry";
import { hand, handAction, handSeat } from "@sapphire2/db/schema/hand";
import { dateOnlySchema } from "@sapphire2/db/schemas/date-only";
import { TRPCError } from "@trpc/server";
import {
	and,
	desc,
	eq,
	exists,
	getTableColumns,
	inArray,
	type SQL,
	sql,
} from "drizzle-orm";
import z from "zod";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { validateEntityOwnership } from "../lib/ownership";
import {
	DEFAULT_HAND_PAGE_SIZE,
	type HandDetailOutput,
	hydrateHandDetails,
	MAX_HAND_PAGE_SIZE,
} from "./hand";

const NULL_PLAYED_AT = -1;
const VPIP_ACTIONS = ["call", "bet", "raise"] as const satisfies HandAction[];
const PFR_ACTIONS = ["bet", "raise"] as const satisfies HandAction[];

const playerHandScopeFields = {
	dateFrom: dateOnlySchema.optional(),
	dateTo: dateOnlySchema.optional(),
	id: z.string().min(1),
};

function validDateRange(input: { dateFrom?: string; dateTo?: string }) {
	return (
		input.dateFrom === undefined ||
		input.dateTo === undefined ||
		input.dateFrom <= input.dateTo
	);
}

const dateRangeMessage = {
	message: "dateFrom must not be after dateTo",
	path: ["dateTo"],
};

export const playerHandsInputSchema = z
	.object({
		...playerHandScopeFields,
		cursor: z.string().optional(),
		limit: z
			.number()
			.int()
			.min(1)
			.max(MAX_HAND_PAGE_SIZE)
			.default(DEFAULT_HAND_PAGE_SIZE),
	})
	.refine(validDateRange, dateRangeMessage);

export const playerHandStatsInputSchema = z
	.object(playerHandScopeFields)
	.refine(validDateRange, dateRangeMessage);

type PlayerHandScope = Pick<
	z.infer<typeof playerHandStatsInputSchema>,
	"dateFrom" | "dateTo" | "id"
>;

const playerHandCursorSchema = z.object({
	id: z.string(),
	playedAt: z.number().int(),
	scope: z.object({
		dateFrom: z.string().nullable(),
		dateTo: z.string().nullable(),
		playerId: z.string(),
		userId: z.string(),
	}),
});

export interface PlayerHandStats {
	fullHandCount: number;
	handCount: number;
	pfr: number | null;
	pfrCount: number;
	pfrOpportunities: number;
	vpip: number | null;
	vpipCount: number;
	vpipOpportunities: number;
}

async function assertOpponent(
	db: Database,
	userId: string,
	playerId: string
): Promise<void> {
	const found = await validateEntityOwnership(db, "player", playerId, userId);
	if (found.isSelf) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Hero is not an opponent",
		});
	}
}

function opponentSeat(userId: string, playerId: string): SQL[] {
	return [
		eq(handSeat.handId, hand.id),
		eq(handSeat.userId, userId),
		eq(handSeat.playerId, playerId),
		eq(handSeat.isHero, false),
	];
}

function scopeConditions(
	db: Database,
	userId: string,
	scope: PlayerHandScope
): SQL[] {
	const conditions: SQL[] = [
		eq(hand.userId, userId),
		exists(
			db
				.select({ one: sql`1` })
				.from(handSeat)
				.where(and(...opponentSeat(userId, scope.id)))
		),
	];
	if (scope.dateFrom) {
		conditions.push(sql`${playSession.localDate} >= ${scope.dateFrom}`);
	}
	if (scope.dateTo) {
		conditions.push(sql`${playSession.localDate} <= ${scope.dateTo}`);
	}
	return conditions;
}

const parentPlay = and(
	eq(playSession.id, hand.playSessionId),
	eq(playSession.userId, hand.userId)
);

const sortTime = sql<number>`coalesce(${hand.playedAt}, ${NULL_PLAYED_AT})`;

export async function listPlayerHands(
	db: Database,
	userId: string,
	input: z.infer<typeof playerHandsInputSchema>
): Promise<{ items: HandDetailOutput[]; nextCursor: string | null }> {
	const scope = {
		dateFrom: input.dateFrom ?? null,
		dateTo: input.dateTo ?? null,
		playerId: input.id,
		userId,
	};
	const cursor =
		input.cursor === undefined
			? undefined
			: decodeCursor(input.cursor, playerHandCursorSchema);
	if (cursor && JSON.stringify(cursor.scope) !== JSON.stringify(scope)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This cursor belongs to another hand list",
		});
	}
	await assertOpponent(db, userId, input.id);
	const conditions = scopeConditions(db, userId, input);
	if (cursor) {
		conditions.push(
			sql`(${sortTime}, ${hand.id}) < (${cursor.playedAt}, ${cursor.id})`
		);
	}
	const rows = await db
		.select(getTableColumns(hand))
		.from(hand)
		.innerJoin(playSession, parentPlay)
		.where(and(...conditions))
		.orderBy(desc(sortTime), desc(hand.id))
		.limit(input.limit + 1);
	const page = rows.slice(0, input.limit);
	const boundary = rows.length > input.limit ? page.at(-1) : undefined;
	return {
		items: await hydrateHandDetails(db, userId, page),
		nextCursor: boundary
			? encodeCursor({
					id: boundary.id,
					playedAt:
						boundary.playedAt === null
							? NULL_PLAYED_AT
							: Math.floor(boundary.playedAt.getTime() / 1000),
					scope,
				})
			: null,
	};
}

function preflopAction(
	db: Database,
	userId: string,
	playerId: string,
	actions: readonly HandAction[]
): SQL {
	return exists(
		db
			.select({ one: sql`1` })
			.from(handAction)
			.innerJoin(
				handSeat,
				and(
					eq(handSeat.handId, handAction.handId),
					eq(handSeat.seat, handAction.seat),
					eq(handSeat.userId, handAction.userId)
				)
			)
			.where(
				and(
					eq(handAction.handId, hand.id),
					eq(handAction.street, 0),
					inArray(handAction.action, [...actions]),
					...opponentSeat(userId, playerId)
				)
			)
	);
}

function percent(count: number, opportunities: number): number | null {
	return opportunities === 0 ? null : (count / opportunities) * 100;
}

export async function playerHandStats(
	db: Database,
	userId: string,
	input: PlayerHandScope
): Promise<PlayerHandStats> {
	await assertOpponent(db, userId, input.id);
	const full = sql`${hand.detail} = 'full'`;
	const countWhere = (condition: SQL) =>
		sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`.mapWith(
			Number
		);
	const [row] = await db
		.select({
			fullHandCount: countWhere(full),
			handCount: sql<number>`count(*)`.mapWith(Number),
			pfrCount: countWhere(
				sql`${full} and ${preflopAction(db, userId, input.id, PFR_ACTIONS)}`
			),
			vpipCount: countWhere(
				sql`${full} and ${preflopAction(db, userId, input.id, VPIP_ACTIONS)}`
			),
		})
		.from(hand)
		.innerJoin(playSession, parentPlay)
		.where(and(...scopeConditions(db, userId, input)));
	const handCount = row?.handCount ?? 0;
	const fullHandCount = row?.fullHandCount ?? 0;
	const vpipCount = row?.vpipCount ?? 0;
	const pfrCount = row?.pfrCount ?? 0;
	return {
		fullHandCount,
		handCount,
		pfr: percent(pfrCount, fullHandCount),
		pfrCount,
		pfrOpportunities: fullHandCount,
		vpip: percent(vpipCount, fullHandCount),
		vpipCount,
		vpipOpportunities: fullHandCount,
	};
}
