import type { Database } from "@sapphire2/db";
import { RULE_PRICE_KINDS } from "@sapphire2/db/constants/rule";
import { asset } from "@sapphire2/db/schema/asset";
import { gameLineupGroup } from "@sapphire2/db/schema/game-lineup";
import {
	tournamentRule,
	tournamentRuleLevel,
	tournamentRuleLevelStake,
	tournamentRulePrice,
} from "@sapphire2/db/schema/rule";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import { type BatchStatement, selectInChunks } from "../lib/batch";
import {
	findBuiltinVariantId,
	type GameInput,
	gameInputSchema,
	insertChunks,
	type Lineup,
	LineupPlanner,
	loadLineups,
} from "./game-lineup";
import {
	type CarriedStake,
	type PlannedStake,
	planStakes,
	type StakeValues,
	stakeInputSchema,
	stakeValues,
} from "./rule-stakes";
import { seedDefaultGameData } from "./seed-game-data";

export const MAX_RULE_LEVELS = 100;
export const MAX_RULE_PRICES = 20;
export const MAX_LEVEL_STAKES = 12;

const MAX_MONEY = 1_000_000_000_000;
const moneySchema = z.number().int().min(0).max(MAX_MONEY);
const chipsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const priceInputSchema = z.object({
	kind: z.enum(RULE_PRICE_KINDS),
	assetId: z.string().min(1),
	amount: moneySchema,
	fee: moneySchema,
	chips: chipsSchema.nullable(),
	label: z.string().trim().max(100).optional(),
});

export const levelInputSchema = z.object({
	isBreak: z.boolean(),
	minutes: z.number().int().min(1).max(10_000).nullable().optional(),
	game: gameInputSchema.nullable().optional(),
	stakes: z.array(stakeInputSchema).max(MAX_LEVEL_STAKES).optional(),
});

const ruleScalarFields = {
	game: gameInputSchema.optional(),
	startingStack: chipsSchema.nullable().optional(),
	bountyAmount: moneySchema.nullable().optional(),
	tableSize: z.number().int().min(2).max(10).nullable().optional(),
	houseRules: z.string().max(50_000).nullable().optional(),
	prices: z.array(priceInputSchema).max(MAX_RULE_PRICES).optional(),
};

const levelsSchema = z.array(levelInputSchema).max(MAX_RULE_LEVELS);

export const tournamentRuleInputSchema = z.object({
	...ruleScalarFields,
	levels: levelsSchema.optional(),
});

export const tournamentRuleWithLevelsInputSchema = z.object({
	...ruleScalarFields,
	levels: levelsSchema,
});

export type TournamentRuleInput = z.infer<typeof tournamentRuleInputSchema>;

type LevelInput = z.infer<typeof levelInputSchema>;
type PriceKind = (typeof RULE_PRICE_KINDS)[number];

export interface RuleStakeOutput extends StakeValues {
	gameGroupId: string;
	lineupGroupId: string;
}

export interface TournamentRuleLevelOutput {
	effectiveLineupId: string;
	game: { lineupId: string } | null;
	id: string;
	isBreak: boolean;
	level: number | null;
	minutes: number | null;
	ordinal: number;
	stakes: RuleStakeOutput[];
}

export interface TournamentRulePriceOutput {
	amount: number;
	assetId: string;
	chips: number | null;
	fee: number;
	id: string;
	kind: PriceKind;
	label: string;
	ordinal: number;
}

export interface TournamentRuleOutput {
	bountyAmount: number | null;
	houseRules: string | null;
	id: string;
	levels: TournamentRuleLevelOutput[];
	lineupId: string;
	parentRuleId: string | null;
	prices: TournamentRulePriceOutput[];
	startingStack: number | null;
	tableSize: number | null;
	tournamentId: string | null;
}

const LOOKUP_EXTRA_PARAMS = 1;

function bucketBy<Row>(
	rows: Row[],
	key: (row: Row) => string
): Map<string, Row[]> {
	const buckets = new Map<string, Row[]>();
	for (const row of rows) {
		const existing = buckets.get(key(row));
		if (existing) {
			existing.push(row);
		} else {
			buckets.set(key(row), [row]);
		}
	}
	return buckets;
}

export function ruleLineupIds(rule: TournamentRuleOutput): string[] {
	return [
		rule.lineupId,
		...rule.levels.map((level) => level.effectiveLineupId),
	];
}

export async function hydrateTournamentRules(
	db: Database,
	userId: string,
	ruleIds: Iterable<string>
): Promise<Map<string, TournamentRuleOutput>> {
	const ids = [...new Set(ruleIds)];
	if (ids.length === 0) {
		return new Map();
	}
	const rules = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select()
				.from(tournamentRule)
				.where(
					and(
						eq(tournamentRule.userId, userId),
						inArray(tournamentRule.id, chunk)
					)
				),
		LOOKUP_EXTRA_PARAMS
	);
	const ownedIds = rules.map((rule) => rule.id);
	const [levels, stakes, prices] = await Promise.all([
		selectInChunks(
			ownedIds,
			(chunk) =>
				db
					.select()
					.from(tournamentRuleLevel)
					.where(
						and(
							eq(tournamentRuleLevel.userId, userId),
							inArray(tournamentRuleLevel.ruleId, chunk)
						)
					),
			LOOKUP_EXTRA_PARAMS
		),
		selectInChunks(
			ownedIds,
			(chunk) =>
				db
					.select({
						levelId: tournamentRuleLevelStake.levelId,
						lineupGroupId: tournamentRuleLevelStake.lineupGroupId,
						gameGroupId: gameLineupGroup.gameGroupId,
						position: gameLineupGroup.position,
						blind1: tournamentRuleLevelStake.blind1,
						blind2: tournamentRuleLevelStake.blind2,
						blind3: tournamentRuleLevelStake.blind3,
						ante: tournamentRuleLevelStake.ante,
						anteType: tournamentRuleLevelStake.anteType,
					})
					.from(tournamentRuleLevelStake)
					.innerJoin(
						tournamentRuleLevel,
						and(
							eq(tournamentRuleLevel.id, tournamentRuleLevelStake.levelId),
							eq(tournamentRuleLevel.userId, tournamentRuleLevelStake.userId)
						)
					)
					.innerJoin(
						gameLineupGroup,
						and(
							eq(gameLineupGroup.id, tournamentRuleLevelStake.lineupGroupId),
							eq(gameLineupGroup.userId, tournamentRuleLevelStake.userId)
						)
					)
					.where(
						and(
							eq(tournamentRuleLevelStake.userId, userId),
							inArray(tournamentRuleLevel.ruleId, chunk)
						)
					),
			LOOKUP_EXTRA_PARAMS
		),
		selectInChunks(
			ownedIds,
			(chunk) =>
				db
					.select()
					.from(tournamentRulePrice)
					.where(
						and(
							eq(tournamentRulePrice.userId, userId),
							inArray(tournamentRulePrice.ruleId, chunk)
						)
					),
			LOOKUP_EXTRA_PARAMS
		),
	]);
	const levelsByRule = bucketBy(levels, (level) => level.ruleId);
	const stakesByLevel = bucketBy(stakes, (stake) => stake.levelId);
	const pricesByRule = bucketBy(prices, (price) => price.ruleId);
	return new Map(
		rules.map((rule) => [
			rule.id,
			{
				id: rule.id,
				tournamentId: rule.tournamentId,
				parentRuleId: rule.parentRuleId,
				lineupId: rule.lineupId,
				startingStack: rule.startingStack,
				tableSize: rule.tableSize,
				bountyAmount: rule.bountyAmount,
				houseRules: rule.houseRules,
				levels: (levelsByRule.get(rule.id) ?? [])
					.toSorted((left, right) => left.ordinal - right.ordinal)
					.map((level) => ({
						id: level.id,
						ordinal: level.ordinal,
						level: level.level,
						isBreak: level.isBreak,
						minutes: level.minutes,
						game: level.inheritsLineup ? null : { lineupId: level.lineupId },
						effectiveLineupId: level.lineupId,
						stakes: (stakesByLevel.get(level.id) ?? [])
							.toSorted((left, right) => left.position - right.position)
							.map((stake) => ({
								lineupGroupId: stake.lineupGroupId,
								gameGroupId: stake.gameGroupId,
								...stakeValues(stake),
							})),
					})),
				prices: (pricesByRule.get(rule.id) ?? [])
					.toSorted((left, right) => left.ordinal - right.ordinal)
					.map((price) => ({
						id: price.id,
						ordinal: price.ordinal,
						kind: price.kind,
						assetId: price.assetId,
						amount: price.amount,
						fee: price.fee,
						chips: price.chips,
						label: price.label,
					})),
			},
		])
	);
}

interface PlannedLevel {
	inherits: boolean;
	isBreak: boolean;
	level: number | null;
	lineup: Lineup;
	minutes: number | null;
	stakes: PlannedStake[];
}

interface PlannedPrice {
	amount: number;
	assetId: string;
	chips: number | null;
	fee: number;
	kind: PriceKind;
	label: string;
}

interface PlannedContent {
	bountyAmount: number | null;
	houseRules: string | null;
	levels: PlannedLevel[];
	lineup: Lineup;
	prices: PlannedPrice[];
	startingStack: number | null;
	tableSize: number | null;
}

function contentSignature(content: {
	bountyAmount: number | null;
	houseRules: string | null;
	levels: {
		inherits: boolean;
		isBreak: boolean;
		level: number | null;
		lineupId: string;
		minutes: number | null;
		stakes: (StakeValues & { lineupGroupId: string })[];
	}[];
	lineupId: string;
	prices: PlannedPrice[];
	startingStack: number | null;
	tableSize: number | null;
}): string {
	return JSON.stringify([
		content.lineupId,
		content.startingStack,
		content.tableSize,
		content.bountyAmount,
		content.houseRules,
		content.levels.map((level) => [
			level.isBreak,
			level.level,
			level.minutes,
			level.inherits,
			level.lineupId,
			level.stakes.map((stake) => [
				stake.lineupGroupId,
				...Object.values(stakeValues(stake)),
			]),
		]),
		content.prices.map((price) => [
			price.kind,
			price.assetId,
			price.amount,
			price.fee,
			price.chips,
			price.label,
		]),
	]);
}

function storedSignature(rule: TournamentRuleOutput): string {
	return contentSignature({
		...rule,
		levels: rule.levels.map((level) => ({
			inherits: level.game === null,
			isBreak: level.isBreak,
			level: level.level,
			lineupId: level.effectiveLineupId,
			minutes: level.minutes,
			stakes: level.stakes,
		})),
		prices: rule.prices,
	});
}

function plannedSignature(content: PlannedContent): string {
	return contentSignature({
		...content,
		lineupId: content.lineup.id,
		levels: content.levels.map((level) => ({
			...level,
			lineupId: level.lineup.id,
		})),
	});
}

function stakeTargets(lineup: Lineup) {
	return lineup.groups.map((group) => ({
		lineupGroupId: group.id,
		gameGroupId: group.gameGroupId,
	}));
}

function carriedStakes(
	level: TournamentRuleLevelOutput | undefined
): CarriedStake[] {
	return level && !level.isBreak ? level.stakes : [];
}

function badRequest(message: string): TRPCError {
	return new TRPCError({ code: "BAD_REQUEST", message });
}

async function assertPriceAssets(
	db: Database,
	userId: string,
	prices: PlannedPrice[],
	keptAssetIds: Set<string>
): Promise<void> {
	const ids = [...new Set(prices.map((price) => price.assetId))];
	if (ids.length === 0) {
		return;
	}
	const rows = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select({ id: asset.id, archivedAt: asset.archivedAt })
				.from(asset)
				.where(and(eq(asset.userId, userId), inArray(asset.id, chunk))),
		LOOKUP_EXTRA_PARAMS
	);
	if (rows.length !== ids.length) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this asset",
		});
	}
	if (
		rows.some((row) => row.archivedAt !== null && !keptAssetIds.has(row.id))
	) {
		throw badRequest("An archived asset cannot be newly selected for a price");
	}
}

function planLevels(
	input: LevelInput[] | undefined,
	current: TournamentRuleOutput | null,
	currentLineups: Map<string, Lineup>,
	defaultLineup: Lineup,
	planner: LineupPlanner
): PlannedLevel[] {
	if (input === undefined) {
		return (current?.levels ?? []).map((level) => {
			const override =
				level.game === null
					? undefined
					: currentLineups.get(level.effectiveLineupId);
			const lineup = override ?? defaultLineup;
			return {
				isBreak: level.isBreak,
				level: level.level,
				minutes: level.minutes,
				inherits: override === undefined,
				lineup,
				stakes: level.isBreak
					? []
					: planStakes(stakeTargets(lineup), undefined, level.stakes),
			};
		});
	}
	let displayed = 0;
	return input.map((level, index) => {
		if (level.isBreak) {
			if ((level.game ?? null) !== null || (level.stakes?.length ?? 0) > 0) {
				throw badRequest("A break has no game or stakes");
			}
			return {
				isBreak: true,
				level: null,
				minutes: level.minutes ?? null,
				inherits: true,
				lineup: defaultLineup,
				stakes: [],
			};
		}
		displayed += 1;
		const lineup = level.game ? planner.resolve(level.game) : defaultLineup;
		return {
			isBreak: false,
			level: displayed,
			minutes: level.minutes ?? null,
			inherits: !level.game,
			lineup,
			stakes: planStakes(
				stakeTargets(lineup),
				level.stakes,
				carriedStakes(current?.levels[index])
			),
		};
	});
}

export interface TournamentRuleWrite {
	ruleId: string;
	statements: BatchStatement[];
}

function carried<Value>(
	supplied: Value | null | undefined,
	current: Value | null | undefined
): Value | null {
	return supplied === undefined ? (current ?? null) : supplied;
}

async function resolveDefaultGame(
	db: Database,
	userId: string,
	input: TournamentRuleInput,
	current: TournamentRuleOutput | null
): Promise<GameInput | undefined> {
	if (input.game || current) {
		return input.game;
	}
	await seedDefaultGameData(db, userId);
	const nlhId = await findBuiltinVariantId(db, userId, "nlh");
	if (!nlhId) {
		throw badRequest("Choose a game for the tournament");
	}
	return { variantId: nlhId };
}

async function planPrices(
	db: Database,
	userId: string,
	input: TournamentRuleInput,
	current: TournamentRuleOutput | null
): Promise<PlannedPrice[]> {
	if (input.prices === undefined) {
		return (current?.prices ?? []).map((price) => ({
			kind: price.kind,
			assetId: price.assetId,
			amount: price.amount,
			fee: price.fee,
			chips: price.chips,
			label: price.label,
		}));
	}
	const prices = input.prices.map((price) => ({
		kind: price.kind,
		assetId: price.assetId,
		amount: price.amount,
		fee: price.fee,
		chips: price.chips,
		label: price.label ?? "",
	}));
	await assertPriceAssets(
		db,
		userId,
		prices,
		new Set(current?.prices.map((price) => price.assetId))
	);
	return prices;
}

export async function planTournamentRuleWrite(params: {
	current: TournamentRuleOutput | null;
	db: Database;
	input: TournamentRuleInput;
	tournamentId: string | null;
	userId: string;
}): Promise<TournamentRuleWrite> {
	const { current, db, input, userId } = params;
	const planner = new LineupPlanner(db, userId);
	const currentLineups = current
		? await loadLineups(db, userId, ruleLineupIds(current))
		: new Map<string, Lineup>();
	planner.addCandidates(currentLineups.values());

	const defaultGame = await resolveDefaultGame(db, userId, input, current);
	const games = [
		...(defaultGame ? [defaultGame] : []),
		...(input.levels ?? []).flatMap((level) =>
			level.game ? [level.game] : []
		),
	];
	await planner.prepare(games);

	const defaultLineup = defaultGame
		? planner.resolve(defaultGame)
		: currentLineups.get(current?.lineupId ?? "");
	if (!defaultLineup) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "The current rule version has no game",
		});
	}

	const prices = await planPrices(db, userId, input, current);

	const content: PlannedContent = {
		lineup: defaultLineup,
		startingStack: carried(input.startingStack, current?.startingStack),
		tableSize: carried(input.tableSize, current?.tableSize),
		bountyAmount: carried(input.bountyAmount, current?.bountyAmount),
		houseRules: carried(input.houseRules, current?.houseRules),
		levels: planLevels(
			input.levels,
			current,
			currentLineups,
			defaultLineup,
			planner
		),
		prices,
	};

	if (current && plannedSignature(content) === storedSignature(current)) {
		return { ruleId: current.id, statements: [] };
	}

	const ruleId = crypto.randomUUID();
	const levelRows = content.levels.map((level, index) => ({
		id: crypto.randomUUID(),
		userId,
		ruleId,
		ordinal: index + 1,
		level: level.level,
		isBreak: level.isBreak,
		minutes: level.minutes,
		lineupId: level.lineup.id,
		inheritsLineup: level.inherits,
		inheritedLineupId: level.inherits ? level.lineup.id : null,
	}));
	const stakeRows = levelRows.flatMap((row, index) =>
		(content.levels[index]?.stakes ?? []).map((stake) => ({
			userId,
			levelId: row.id,
			lineupGroupId: stake.lineupGroupId,
			lineupId: row.lineupId,
			...stakeValues(stake),
		}))
	);
	const priceRows = content.prices.map((price, index) => ({
		id: crypto.randomUUID(),
		userId,
		ruleId,
		ordinal: index + 1,
		...price,
	}));
	return {
		ruleId,
		statements: [
			...planner.statements(),
			db.insert(tournamentRule).values({
				id: ruleId,
				userId,
				tournamentId: params.tournamentId,
				parentRuleId: current?.id ?? null,
				lineupId: defaultLineup.id,
				startingStack: content.startingStack,
				tableSize: content.tableSize,
				bountyAmount: content.bountyAmount,
				houseRules: content.houseRules,
			}),
			...insertChunks(levelRows, (chunk) =>
				db.insert(tournamentRuleLevel).values(chunk)
			),
			...insertChunks(stakeRows, (chunk) =>
				db.insert(tournamentRuleLevelStake).values(chunk)
			),
			...insertChunks(priceRows, (chunk) =>
				db.insert(tournamentRulePrice).values(chunk)
			),
		],
	};
}
