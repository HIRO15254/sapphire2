import type { Database } from "@sapphire2/db";
import type { ANTE_TYPES } from "@sapphire2/db/constants/rule";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { anteTypeSchema } from "@sapphire2/db/schemas/game";
import { idSchema } from "@sapphire2/db/schemas/id";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import z from "zod";
import { type BatchStatement, selectInChunks } from "../lib/batch";
import { guardStatement } from "../lib/write-guard";

const blindAmountSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const stakeInputSchema = z.object({
	ante: blindAmountSchema.nullable().optional(),
	anteType: anteTypeSchema.nullable().optional(),
	blind1: blindAmountSchema.nullable().optional(),
	blind2: blindAmountSchema.nullable().optional(),
	blind3: blindAmountSchema.nullable().optional(),
	gameGroupId: idSchema,
});

export type StakeInput = z.infer<typeof stakeInputSchema>;

export interface StakeValues {
	ante: number | null;
	anteType: (typeof ANTE_TYPES)[number] | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
}

export interface StakeTarget {
	gameGroupId: string;
	lineupGroupId: string;
}

export interface CarriedStake extends StakeValues {
	gameGroupId: string;
}

export type PlannedStake = StakeTarget & StakeValues;

const EMPTY_STAKE: StakeValues = {
	ante: null,
	anteType: null,
	blind1: null,
	blind2: null,
	blind3: null,
};

function withStructureKeys<Item extends { gameGroupId: string }>(
	items: Item[]
): [string, Item][] {
	const seen = new Map<string, number>();
	return items.map((item) => {
		const occurrence = seen.get(item.gameGroupId) ?? 0;
		seen.set(item.gameGroupId, occurrence + 1);
		return [`${item.gameGroupId}#${occurrence}`, item];
	});
}

export function stakeValues(stake: StakeValues): StakeValues {
	return {
		ante: stake.ante,
		anteType: stake.anteType,
		blind1: stake.blind1,
		blind2: stake.blind2,
		blind3: stake.blind3,
	};
}

export function planStakes(
	groups: StakeTarget[],
	supplied: StakeInput[] | undefined,
	previous: CarriedStake[]
): PlannedStake[] {
	if (supplied === undefined) {
		const carried = new Map(withStructureKeys(previous));
		return withStructureKeys(groups).map(([key, group]) => {
			const source = carried.get(key);
			return { ...group, ...(source ? stakeValues(source) : EMPTY_STAKE) };
		});
	}
	const mismatch = new TRPCError({
		code: "BAD_REQUEST",
		message:
			"Stakes must list one entry per game group of the game, in group order",
	});
	if (supplied.length !== groups.length) {
		throw mismatch;
	}
	return groups.map((group, index) => {
		const stake = supplied[index];
		if (stake?.gameGroupId !== group.gameGroupId) {
			throw mismatch;
		}
		return {
			...group,
			ante: stake.ante ?? null,
			anteType: stake.anteType ?? null,
			blind1: stake.blind1 ?? null,
			blind2: stake.blind2 ?? null,
			blind3: stake.blind3 ?? null,
		};
	});
}

const BLIND_FIELDS = [
	{ label: "blind1Label", required: "blind1Required", value: "blind1" },
	{ label: "blind2Label", required: "blind2Required", value: "blind2" },
	{ label: "blind3Label", required: "blind3Required", value: "blind3" },
] as const;

export async function assertStakeBlinds(
	db: Database,
	userId: string,
	stakes: (StakeValues & { gameGroupId: string })[]
): Promise<BatchStatement[]> {
	const ids = [...new Set(stakes.map((stake) => stake.gameGroupId))];
	if (ids.length === 0) {
		return [];
	}
	const rows = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select()
				.from(gameGroup)
				.where(and(eq(gameGroup.userId, userId), inArray(gameGroup.id, chunk))),
		1
	);
	const groups = new Map(rows.map((row) => [row.id, row]));
	for (const stake of stakes) {
		const group = groups.get(stake.gameGroupId);
		if (!group) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You do not own this game group",
			});
		}
		for (const field of BLIND_FIELDS) {
			const label = group[field.label];
			const value = stake[field.value];
			if (label === null && value !== null) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `${group.label} has no ${field.value} field; leave it empty`,
				});
			}
			if (label !== null && group[field.required] && value === null) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `${label} is required for ${group.label}`,
				});
			}
		}
	}
	const guards: BatchStatement[] = [];
	for (let index = 0; index < rows.length; index += 10) {
		const conditions = rows.slice(index, index + 10).map(
			(group) =>
				sql`EXISTS (SELECT 1 FROM ${gameGroup}
				WHERE ${gameGroup.id} = ${group.id} AND ${gameGroup.userId} = ${userId}
				AND ${gameGroup.label} IS ${group.label}
				AND ${gameGroup.blind1Label} IS ${group.blind1Label}
				AND ${gameGroup.blind2Label} IS ${group.blind2Label}
				AND ${gameGroup.blind3Label} IS ${group.blind3Label}
				AND ${gameGroup.blind1Required} IS ${Number(group.blind1Required)}
				AND ${gameGroup.blind2Required} IS ${Number(group.blind2Required)}
				AND ${gameGroup.blind3Required} IS ${Number(group.blind3Required)})`
		);
		guards.push(
			guardStatement(db, "stake-blinds", sql.join(conditions, sql` AND `))
		);
	}
	return guards;
}
