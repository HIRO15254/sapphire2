import type { Database } from "@sapphire2/db";
import { ANTE_TYPES } from "@sapphire2/db/constants/rule";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import { selectInChunks } from "../lib/batch";

const blindAmountSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const stakeInputSchema = z.object({
	gameGroupId: z.string().min(1),
	blind1: blindAmountSchema.nullable().optional(),
	blind2: blindAmountSchema.nullable().optional(),
	blind3: blindAmountSchema.nullable().optional(),
	ante: blindAmountSchema.nullable().optional(),
	anteType: z.enum(ANTE_TYPES).nullable().optional(),
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
	blind1: null,
	blind2: null,
	blind3: null,
	ante: null,
	anteType: null,
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
		blind1: stake.blind1,
		blind2: stake.blind2,
		blind3: stake.blind3,
		ante: stake.ante,
		anteType: stake.anteType,
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
			blind1: stake.blind1 ?? null,
			blind2: stake.blind2 ?? null,
			blind3: stake.blind3 ?? null,
			ante: stake.ante ?? null,
			anteType: stake.anteType ?? null,
		};
	});
}

const BLIND_FIELDS = [
	{ value: "blind1", label: "blind1Label", required: "blind1Required" },
	{ value: "blind2", label: "blind2Label", required: "blind2Required" },
	{ value: "blind3", label: "blind3Label", required: "blind3Required" },
] as const;

export async function assertStakeBlinds(
	db: Database,
	userId: string,
	stakes: (StakeValues & { gameGroupId: string })[]
): Promise<void> {
	const ids = [...new Set(stakes.map((stake) => stake.gameGroupId))];
	if (ids.length === 0) {
		return;
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
}
