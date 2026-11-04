import type { Database } from "@sapphire2/db";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { validateOwnedIds } from "../lib/ownership";
import type { Lineup } from "./game-lineups";

const amount = z.number().int().min(0).nullable().optional();
export const stakeInputSchema = z.object({
	gameGroupId: z.string().min(1),
	blind1: amount,
	blind2: amount,
	blind3: amount,
	ante: amount,
	anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
});
export type StakeInput = z.infer<typeof stakeInputSchema>;
export interface RuleStake {
	ante: number | null;
	anteType: "none" | "all" | "bb" | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	gameGroupId: string;
	lineupGroupId: string;
}

export async function resolveRuleStakes(
	db: Database,
	userId: string,
	groups: Lineup["groups"],
	supplied?: StakeInput[],
	previousGroups?: Lineup["groups"],
	previousStakes?: RuleStake[]
): Promise<RuleStake[]> {
	if (supplied) {
		await validateOwnedIds(
			db,
			gameGroup,
			supplied.map((stake) => stake.gameGroupId),
			userId
		);
		if (
			supplied.length !== groups.length ||
			supplied.some(
				(stake, index) => stake.gameGroupId !== groups[index]?.gameGroupId
			)
		) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Stakes must match lineup groups in order",
			});
		}
	}
	const oldByGroup = new Map<string, RuleStake[]>();
	const oldStakesById = new Map(
		previousStakes?.map((stake) => [stake.lineupGroupId, stake])
	);
	for (const group of previousGroups ?? []) {
		const stake = oldStakesById.get(group.id);
		if (stake) {
			const bucket = oldByGroup.get(group.gameGroupId) ?? [];
			bucket.push(stake);
			oldByGroup.set(group.gameGroupId, bucket);
		}
	}
	const occurrences = new Map<string, number>();
	return groups.map((group, index) => {
		const occurrence = occurrences.get(group.gameGroupId) ?? 0;
		occurrences.set(group.gameGroupId, occurrence + 1);
		const stake =
			supplied?.[index] ?? oldByGroup.get(group.gameGroupId)?.[occurrence];
		return {
			lineupGroupId: group.id,
			gameGroupId: group.gameGroupId,
			blind1: stake?.blind1 ?? null,
			blind2: stake?.blind2 ?? null,
			blind3: stake?.blind3 ?? null,
			ante: stake?.ante ?? null,
			anteType: stake?.anteType ?? null,
		};
	});
}
