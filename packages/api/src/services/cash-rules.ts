import type { Database } from "@sapphire2/db";
import { LEDGER_MAX_QUANTITY } from "@sapphire2/db/constants/ledger";
import {
	MAX_RULE_TABLE_SIZE,
	MIN_RULE_TABLE_SIZE,
} from "@sapphire2/db/constants/rule";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { cashRule, cashRuleStake } from "@sapphire2/db/schema/rule";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import {
	type BatchStatement,
	insertChunks,
	selectInChunks,
} from "../lib/batch";
import { validateOwnedIds } from "../lib/ownership";
import {
	gameInputSchema,
	hydrateLineups,
	type Lineup,
	type LineupMap,
	LineupPlanner,
	loadLineups,
	MAX_LINEUP_GROUPS,
	resolveDefaultGame,
} from "./game-lineup";
import {
	assertStakeBlinds,
	type PlannedStake,
	planStakes,
	stakeInputSchema,
	stakeValues,
} from "./rule-stakes";

const amount = z
	.number()
	.int()
	.min(0)
	.max(LEDGER_MAX_QUANTITY)
	.nullable()
	.optional();
export const cashRuleInputSchema = z
	.object({
		game: gameInputSchema.optional(),
		stakes: z.array(stakeInputSchema).max(MAX_LINEUP_GROUPS).optional(),
		minBuyIn: amount,
		maxBuyIn: amount,
		tableSize: z
			.number()
			.int()
			.min(MIN_RULE_TABLE_SIZE)
			.max(MAX_RULE_TABLE_SIZE)
			.nullable()
			.optional(),
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

export interface CashRuleOutput {
	houseRules: string | null;
	id: string;
	lineupId: string;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	parentRuleId: string | null;
	ringGameId: string | null;
	stakes: PlannedStake[];
	tableSize: number | null;
}

export async function hydrateCashRules(
	db: Database,
	userId: string,
	ids: string[]
): Promise<{ rules: Map<string, CashRuleOutput>; lineups: LineupMap }> {
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
	const rules = new Map<string, CashRuleOutput>(
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

function mergeCashScalars(
	input: CashRuleInput,
	current: Pick<
		CashRuleContent,
		"minBuyIn" | "maxBuyIn" | "tableSize" | "houseRules"
	> | null
) {
	return {
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
	if (current && current.ringGameId !== ringGameId) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Invalid current ring game rule",
		});
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
		current !== undefined,
		"Choose a game for the ring game"
	);
	await validateOwnedIds(
		db,
		gameGroup,
		(input.stakes ?? []).map((stake) => stake.gameGroupId),
		userId
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
	const scalars = mergeCashScalars(input, current ?? null);
	validateBuyInRange(scalars.minBuyIn, scalars.maxBuyIn);
	const content: CashRuleContent = { lineupId: lineup.id, stakes, ...scalars };
	if (current && cashSignature(current) === cashSignature(content)) {
		return { id: current.id, statements: [] as BatchStatement[] };
	}
	await assertStakeBlinds(db, userId, stakes);
	const id = crypto.randomUUID();
	const statements: BatchStatement[] = [
		...planner.statements(),
		...cashRuleInsertStatements(
			db,
			userId,
			{ id, ringGameId, parentRuleId: current?.id ?? null },
			content
		),
	];
	return { id, statements };
}

type CashRuleContent = Omit<
	CashRuleOutput,
	"id" | "parentRuleId" | "ringGameId"
>;

function cashSignature(content: CashRuleContent): string {
	return JSON.stringify([
		content.lineupId,
		content.stakes.map((stake) => [stake.lineupGroupId, stakeValues(stake)]),
		content.minBuyIn,
		content.maxBuyIn,
		content.tableSize,
		content.houseRules,
	]);
}

function cashRuleInsertStatements(
	db: Database,
	userId: string,
	version: {
		id: string;
		parentRuleId: string | null;
		ringGameId: string | null;
	},
	content: CashRuleContent
): BatchStatement[] {
	const rows = content.stakes.map((stake) => ({
		userId,
		ruleId: version.id,
		lineupId: content.lineupId,
		lineupGroupId: stake.lineupGroupId,
		...stakeValues(stake),
	}));
	return [
		db.insert(cashRule).values({
			id: version.id,
			userId,
			ringGameId: version.ringGameId,
			parentRuleId: version.parentRuleId,
			lineupId: content.lineupId,
			minBuyIn: content.minBuyIn,
			maxBuyIn: content.maxBuyIn,
			tableSize: content.tableSize,
			houseRules: content.houseRules,
		}),
		...insertChunks(rows, (chunk) => db.insert(cashRuleStake).values(chunk)),
	];
}

export async function planCashRuleCopy(
	db: Database,
	userId: string,
	source: CashRuleOutput,
	target: { parent: CashRuleOutput | null; ringGameId: string | null }
): Promise<{ id: string; statements: BatchStatement[] }> {
	if (target.parent && target.parent.ringGameId !== target.ringGameId) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Invalid current ring game rule",
		});
	}
	if (target.parent && cashSignature(target.parent) === cashSignature(source)) {
		return { id: target.parent.id, statements: [] };
	}
	await assertStakeBlinds(db, userId, source.stakes);
	const id = crypto.randomUUID();
	return {
		id,
		statements: cashRuleInsertStatements(
			db,
			userId,
			{
				id,
				ringGameId: target.ringGameId,
				parentRuleId: target.parent?.id ?? null,
			},
			source
		),
	};
}
