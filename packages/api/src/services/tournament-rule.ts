import type { Database } from "@sapphire2/db";
import { LEDGER_MAX_QUANTITY } from "@sapphire2/db/constants/ledger";
import {
	MAX_RULE_TABLE_SIZE,
	MIN_RULE_TABLE_SIZE,
	RULE_PRICE_KINDS,
} from "@sapphire2/db/constants/rule";
import { asset } from "@sapphire2/db/schema/asset";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameLineupGroup } from "@sapphire2/db/schema/game-lineup";
import {
	tournamentRule,
	tournamentRuleLevel,
	tournamentRuleLevelStake,
	tournamentRulePrice,
} from "@sapphire2/db/schema/rule";
import { idSchema } from "@sapphire2/db/schemas/id";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import { activeReferencesGuard } from "../lib/active-reference-guard";
import {
	type BatchStatement,
	insertChunks,
	selectInChunks,
} from "../lib/batch";
import { validateOwnedIds } from "../lib/ownership";
import {
	gameInputSchema,
	type Lineup,
	LineupPlanner,
	loadLineups,
	MAX_LINEUP_GROUPS,
	resolveDefaultGame,
} from "./game-lineup";
import {
	assertStakeBlinds,
	type CarriedStake,
	type PlannedStake,
	planStakes,
	type StakeValues,
	stakeInputSchema,
	stakeValues,
} from "./rule-stakes";

export const MAX_RULE_LEVELS = 100;
export const MAX_RULE_PRICES = 20;
const moneySchema = z.number().int().min(0).max(LEDGER_MAX_QUANTITY);
const chipsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const priceInputSchema = z.object({
	amount: moneySchema,
	assetId: idSchema,
	chips: chipsSchema.nullable(),
	fee: moneySchema,
	kind: z.enum(RULE_PRICE_KINDS),
	label: z.string().trim().max(100).optional(),
});

export const levelInputSchema = z.object({
	game: gameInputSchema.nullable().optional(),
	isBreak: z.boolean(),
	minutes: z.number().int().min(1).max(10_000).nullable().optional(),
	stakes: z.array(stakeInputSchema).max(MAX_LINEUP_GROUPS).optional(),
});

const ruleScalarFields = {
	bountyAmount: moneySchema.nullable().optional(),
	game: gameInputSchema.optional(),
	houseRules: z.string().max(50_000).nullable().optional(),
	prices: z.array(priceInputSchema).max(MAX_RULE_PRICES).optional(),
	startingStack: chipsSchema.nullable().optional(),
	tableSize: z
		.number()
		.int()
		.min(MIN_RULE_TABLE_SIZE)
		.max(MAX_RULE_TABLE_SIZE)
		.nullable()
		.optional(),
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
						ante: tournamentRuleLevelStake.ante,
						anteType: tournamentRuleLevelStake.anteType,
						blind1: tournamentRuleLevelStake.blind1,
						blind2: tournamentRuleLevelStake.blind2,
						blind3: tournamentRuleLevelStake.blind3,
						gameGroupId: gameLineupGroup.gameGroupId,
						levelId: tournamentRuleLevelStake.levelId,
						lineupGroupId: tournamentRuleLevelStake.lineupGroupId,
						position: gameLineupGroup.position,
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
				bountyAmount: rule.bountyAmount,
				houseRules: rule.houseRules,
				id: rule.id,
				levels: (levelsByRule.get(rule.id) ?? [])
					.toSorted((left, right) => left.ordinal - right.ordinal)
					.map((level) => ({
						effectiveLineupId: level.lineupId,
						game: level.inheritsLineup ? null : { lineupId: level.lineupId },
						id: level.id,
						isBreak: level.isBreak,
						level: level.level,
						minutes: level.minutes,
						ordinal: level.ordinal,
						stakes: (stakesByLevel.get(level.id) ?? [])
							.toSorted((left, right) => left.position - right.position)
							.map((stake) => ({
								gameGroupId: stake.gameGroupId,
								lineupGroupId: stake.lineupGroupId,
								...stakeValues(stake),
							})),
					})),
				lineupId: rule.lineupId,
				parentRuleId: rule.parentRuleId,
				prices: (pricesByRule.get(rule.id) ?? [])
					.toSorted((left, right) => left.ordinal - right.ordinal)
					.map((price) => ({
						amount: price.amount,
						assetId: price.assetId,
						chips: price.chips,
						fee: price.fee,
						id: price.id,
						kind: price.kind,
						label: price.label,
						ordinal: price.ordinal,
					})),
				startingStack: rule.startingStack,
				tableSize: rule.tableSize,
				tournamentId: rule.tournamentId,
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

interface TournamentRuleContent {
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
}

function contentSignature(content: TournamentRuleContent): string {
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

function storedContent(rule: TournamentRuleOutput): TournamentRuleContent {
	return {
		bountyAmount: rule.bountyAmount,
		houseRules: rule.houseRules,
		levels: rule.levels.map((level) => ({
			inherits: level.game === null,
			isBreak: level.isBreak,
			level: level.level,
			lineupId: level.effectiveLineupId,
			minutes: level.minutes,
			stakes: level.stakes,
		})),
		lineupId: rule.lineupId,
		prices: rule.prices.map((price) => ({
			amount: price.amount,
			assetId: price.assetId,
			chips: price.chips,
			fee: price.fee,
			kind: price.kind,
			label: price.label,
		})),
		startingStack: rule.startingStack,
		tableSize: rule.tableSize,
	};
}

function plannedContent(content: PlannedContent): TournamentRuleContent {
	return {
		...content,
		levels: content.levels.map((level) => ({
			...level,
			lineupId: level.lineup.id,
		})),
		lineupId: content.lineup.id,
	};
}

function stakeTargets(lineup: Lineup) {
	return lineup.groups.map((group) => ({
		gameGroupId: group.gameGroupId,
		lineupGroupId: group.id,
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
	keptPrices: TournamentRulePriceOutput[]
): Promise<void> {
	const ids = [...new Set(prices.map((price) => price.assetId))];
	if (ids.length === 0) {
		return;
	}
	const rows = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select({ archivedAt: asset.archivedAt, id: asset.id })
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
	const archived = new Set(
		rows.filter((row) => row.archivedAt !== null).map((row) => row.id)
	);
	const remaining = new Map<string, number>();
	for (const price of keptPrices) {
		remaining.set(price.assetId, (remaining.get(price.assetId) ?? 0) + 1);
	}
	for (const price of prices) {
		if (archived.has(price.assetId)) {
			const count = remaining.get(price.assetId) ?? 0;
			if (count === 0) {
				throw badRequest(
					"An archived asset cannot be newly selected for a price"
				);
			}
			remaining.set(price.assetId, count - 1);
		}
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
				inherits: override === undefined,
				isBreak: level.isBreak,
				level: level.level,
				lineup,
				minutes: level.minutes,
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
				inherits: true,
				isBreak: true,
				level: null,
				lineup: defaultLineup,
				minutes: level.minutes ?? null,
				stakes: [],
			};
		}
		displayed += 1;
		const lineup = level.game ? planner.resolve(level.game) : defaultLineup;
		return {
			inherits: !level.game,
			isBreak: false,
			level: displayed,
			lineup,
			minutes: level.minutes ?? null,
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

async function planPrices(
	db: Database,
	userId: string,
	input: TournamentRuleInput,
	current: TournamentRuleOutput | null
): Promise<PlannedPrice[]> {
	if (input.prices === undefined) {
		return (current?.prices ?? []).map((price) => ({
			amount: price.amount,
			assetId: price.assetId,
			chips: price.chips,
			fee: price.fee,
			kind: price.kind,
			label: price.label,
		}));
	}
	const prices = input.prices.map((price) => ({
		amount: price.amount,
		assetId: price.assetId,
		chips: price.chips,
		fee: price.fee,
		kind: price.kind,
		label: price.label ?? "",
	}));
	await assertPriceAssets(db, userId, prices, current?.prices ?? []);
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

	const defaultGame = await resolveDefaultGame(
		db,
		userId,
		input.game,
		current !== null,
		"Choose a game for the tournament"
	);
	await validateOwnedIds(
		db,
		gameGroup,
		(input.levels ?? []).flatMap((level) =>
			(level.stakes ?? []).map((stake) => stake.gameGroupId)
		),
		userId
	);
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
		bountyAmount: carried(input.bountyAmount, current?.bountyAmount),
		houseRules: carried(input.houseRules, current?.houseRules),
		levels: planLevels(
			input.levels,
			current,
			currentLineups,
			defaultLineup,
			planner
		),
		lineup: defaultLineup,
		prices,
		startingStack: carried(input.startingStack, current?.startingStack),
		tableSize: carried(input.tableSize, current?.tableSize),
	};

	const planned = plannedContent(content);
	if (
		current &&
		contentSignature(planned) === contentSignature(storedContent(current))
	) {
		return { ruleId: current.id, statements: [] };
	}
	const stakeGuards = await assertStakeBlinds(
		db,
		userId,
		content.levels.flatMap((level) => level.stakes)
	);

	const remainingAssets = new Map<string, number>();
	for (const price of current?.prices ?? []) {
		remainingAssets.set(
			price.assetId,
			(remainingAssets.get(price.assetId) ?? 0) + 1
		);
	}
	const newAssets = new Set<string>();
	for (const price of prices) {
		const count = remainingAssets.get(price.assetId) ?? 0;
		if (count > 0) {
			remainingAssets.set(price.assetId, count - 1);
		} else {
			newAssets.add(price.assetId);
		}
	}
	const ruleId = crypto.randomUUID();
	return {
		ruleId,
		statements: [
			...(newAssets.size
				? [activeReferencesGuard(db, asset, newAssets, userId)]
				: []),
			...stakeGuards,
			...planner.statements(),
			...tournamentRuleInsertStatements(
				db,
				userId,
				{
					id: ruleId,
					parentRuleId: current?.id ?? null,
					tournamentId: params.tournamentId,
				},
				planned
			),
		],
	};
}

function tournamentRuleInsertStatements(
	db: Database,
	userId: string,
	version: {
		id: string;
		parentRuleId: string | null;
		tournamentId: string | null;
	},
	content: TournamentRuleContent
): BatchStatement[] {
	const levelRows = content.levels.map((level, index) => ({
		id: crypto.randomUUID(),
		inheritedLineupId: level.inherits ? level.lineupId : null,
		inheritsLineup: level.inherits,
		isBreak: level.isBreak,
		level: level.level,
		lineupId: level.lineupId,
		minutes: level.minutes,
		ordinal: index + 1,
		ruleId: version.id,
		userId,
	}));
	const stakeRows = levelRows.flatMap((row, index) =>
		(content.levels[index]?.stakes ?? []).map((stake) => ({
			levelId: row.id,
			lineupGroupId: stake.lineupGroupId,
			lineupId: row.lineupId,
			userId,
			...stakeValues(stake),
		}))
	);
	const priceRows = content.prices.map((price, index) => ({
		amount: price.amount,
		assetId: price.assetId,
		chips: price.chips,
		fee: price.fee,
		id: crypto.randomUUID(),
		kind: price.kind,
		label: price.label,
		ordinal: index + 1,
		ruleId: version.id,
		userId,
	}));
	return [
		db.insert(tournamentRule).values({
			bountyAmount: content.bountyAmount,
			houseRules: content.houseRules,
			id: version.id,
			lineupId: content.lineupId,
			parentRuleId: version.parentRuleId,
			startingStack: content.startingStack,
			tableSize: content.tableSize,
			tournamentId: version.tournamentId,
			userId,
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
	];
}

export async function planTournamentRuleCopy(
	db: Database,
	userId: string,
	source: TournamentRuleOutput,
	target: { parent: TournamentRuleOutput | null; tournamentId: string | null }
): Promise<TournamentRuleWrite> {
	const content = storedContent(source);
	if (
		target.parent &&
		contentSignature(storedContent(target.parent)) === contentSignature(content)
	) {
		return { ruleId: target.parent.id, statements: [] };
	}
	const stakeGuards = await assertStakeBlinds(
		db,
		userId,
		source.levels.flatMap((level) => level.stakes)
	);
	const ruleId = crypto.randomUUID();
	return {
		ruleId,
		statements: [
			...stakeGuards,
			...tournamentRuleInsertStatements(
				db,
				userId,
				{
					id: ruleId,
					parentRuleId: target.parent?.id ?? null,
					tournamentId: target.tournamentId,
				},
				content
			),
		],
	};
}
