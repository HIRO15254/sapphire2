import type { Database } from "@sapphire2/db";
import { cashRule, cashRuleStake } from "@sapphire2/db/schema/rule";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import { type BatchStatement, selectInChunks } from "../lib/batch";
import {
	findBuiltinVariantId,
	type GameInput,
	gameInputSchema,
	hydrateLineups,
	insertChunks,
	type Lineup,
	LineupPlanner,
	loadLineups,
	MAX_LINEUP_GROUPS,
} from "./game-lineup";
import {
	assertStakeBlinds,
	planStakes,
	stakeInputSchema,
	stakeValues,
} from "./rule-stakes";
import { seedDefaultGameData } from "./seed-game-data";

const amount = z.number().int().min(0).nullable().optional();
export const cashRuleInputSchema = z
	.object({
		game: gameInputSchema.optional(),
		stakes: z.array(stakeInputSchema).max(MAX_LINEUP_GROUPS).optional(),
		minBuyIn: amount,
		maxBuyIn: amount,
		tableSize: z.number().int().min(2).max(10).nullable().optional(),
		houseRules: z.string().max(50_000).nullable().optional(),
	})
	.refine(
		(value) =>
			value.minBuyIn == null ||
			value.maxBuyIn == null ||
			value.minBuyIn <= value.maxBuyIn,
		{
			message: "Minimum buy-in must not exceed maximum buy-in",
			path: ["maxBuyIn"],
		}
	);
export type CashRuleInput = z.infer<typeof cashRuleInputSchema>;

export async function hydrateCashRules(
	db: Database,
	userId: string,
	ids: string[]
) {
	const versions = await selectInChunks(
		[...new Set(ids)],
		(chunk) =>
			db
				.select()
				.from(cashRule)
				.where(and(eq(cashRule.userId, userId), inArray(cashRule.id, chunk))),
		1
	);
	const stakes = await selectInChunks(
		versions.map((v) => v.id),
		(chunk) =>
			db
				.select()
				.from(cashRuleStake)
				.where(
					and(
						eq(cashRuleStake.userId, userId),
						inArray(cashRuleStake.ruleId, chunk)
					)
				),
		1
	);
	const lineups = await hydrateLineups(
		db,
		userId,
		versions.map((v) => v.lineupId)
	);
	const rules = new Map(
		versions.map((v) => {
			const lineup = lineups[v.lineupId];
			if (!lineup) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Missing rule lineup",
				});
			}
			const ordered = lineup.groups.map((g) => {
				const row = stakes.find(
					(s) => s.ruleId === v.id && s.lineupGroupId === g.id
				);
				if (!row) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Missing rule stake",
					});
				}
				return {
					lineupGroupId: g.id,
					gameGroupId: g.gameGroupId,
					blind1: row.blind1,
					blind2: row.blind2,
					blind3: row.blind3,
					ante: row.ante,
					anteType: row.anteType,
				};
			});
			return [
				v.id,
				{
					id: v.id,
					ringGameId: v.ringGameId,
					parentRuleId: v.parentRuleId,
					lineupId: v.lineupId,
					stakes: ordered,
					minBuyIn: v.minBuyIn,
					maxBuyIn: v.maxBuyIn,
					tableSize: v.tableSize,
					houseRules: v.houseRules,
				},
			] as const;
		})
	);
	return { rules, lineups };
}

function validateBuyInRange(min: number | null, max: number | null): void {
	if (min !== null && max !== null && min > max) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Minimum buy-in must not exceed maximum buy-in",
		});
	}
}

async function resolveDefaultGame(
	db: Database,
	userId: string,
	game: GameInput | undefined,
	hasCurrent: boolean
): Promise<GameInput | undefined> {
	if (game || hasCurrent) {
		return game;
	}
	await seedDefaultGameData(db, userId);
	const nlhId = await findBuiltinVariantId(db, userId, "nlh");
	if (!nlhId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Choose a game for the ring game",
		});
	}
	return { variantId: nlhId };
}
export async function prepareCashRule(
	db: Database,
	userId: string,
	ringGameId: string | null,
	input: CashRuleInput,
	currentId?: string
) {
	const current = currentId
		? (await hydrateCashRules(db, userId, [currentId])).rules.get(currentId)
		: undefined;
	if (currentId && !current) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Rule unavailable" });
	}
	const planner = new LineupPlanner(db, userId);
	const currentLineups: Map<string, Lineup> = current
		? await loadLineups(db, userId, [current.lineupId])
		: new Map();
	planner.addCandidates(currentLineups.values());
	const game = await resolveDefaultGame(
		db,
		userId,
		input.game,
		current !== undefined
	);
	if (game) {
		await planner.prepare([game]);
	}
	const lineup = game
		? planner.resolve(game)
		: currentLineups.get(current?.lineupId ?? "");
	if (!lineup) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "The current rule version has no game",
		});
	}
	const stakes = planStakes(
		lineup.groups.map((group) => ({
			gameGroupId: group.gameGroupId,
			lineupGroupId: group.id,
		})),
		input.stakes,
		current?.stakes ?? []
	);
	const scalars = {
		minBuyIn:
			input.minBuyIn === undefined
				? (current?.minBuyIn ?? null)
				: input.minBuyIn,
		maxBuyIn:
			input.maxBuyIn === undefined
				? (current?.maxBuyIn ?? null)
				: input.maxBuyIn,
		tableSize:
			input.tableSize === undefined
				? (current?.tableSize ?? null)
				: input.tableSize,
		houseRules:
			input.houseRules === undefined
				? (current?.houseRules ?? null)
				: input.houseRules,
	};
	validateBuyInRange(scalars.minBuyIn, scalars.maxBuyIn);
	if (
		current &&
		current.lineupId === lineup.id &&
		JSON.stringify(
			stakes.map((stake) => [stake.lineupGroupId, stakeValues(stake)])
		) ===
			JSON.stringify(
				current.stakes.map((stake) => [stake.lineupGroupId, stakeValues(stake)])
			) &&
		current.minBuyIn === scalars.minBuyIn &&
		current.maxBuyIn === scalars.maxBuyIn &&
		current.tableSize === scalars.tableSize &&
		current.houseRules === scalars.houseRules
	) {
		return { id: current.id, statements: [] as BatchStatement[] };
	}
	await assertStakeBlinds(db, userId, stakes);
	const id = crypto.randomUUID();
	const rows = stakes.map((stake) => ({
		userId,
		ruleId: id,
		lineupId: lineup.id,
		lineupGroupId: stake.lineupGroupId,
		...stakeValues(stake),
	}));
	const statements: BatchStatement[] = [
		...planner.statements(),
		db.insert(cashRule).values({
			id,
			userId,
			ringGameId,
			parentRuleId: current?.id ?? null,
			lineupId: lineup.id,
			...scalars,
		}),
		...insertChunks(rows, (chunk) => db.insert(cashRuleStake).values(chunk)),
	];
	return { id, statements };
}
