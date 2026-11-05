import type { Database } from "@sapphire2/db";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import {
	gameLineup,
	gameLineupGroup,
	gameLineupVariant,
} from "@sapphire2/db/schema/game-lineup";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import { idSchema } from "@sapphire2/db/schemas/id";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import {
	type BatchStatement,
	insertChunks,
	selectInChunks,
} from "../lib/batch";
import { seedDefaultGameData } from "./seed-game-data";

export const MAX_LINEUP_GROUPS = MAX_MIX_GROUPS;

export const gameInputSchema = z.union([
	z.object({ variantId: idSchema }).strict(),
	z.object({ gameMixId: idSchema }).strict(),
	z.object({ lineupId: idSchema }).strict(),
]);

export type GameInput = z.infer<typeof gameInputSchema>;

export interface LineupGroup {
	gameGroupId: string;
	id: string;
	name: string | null;
	variantIds: string[];
}

export interface Lineup {
	gameMixId: string | null;
	groups: LineupGroup[];
	id: string;
}

export interface LineupOutput {
	displayName: string;
	gameMixId: string | null;
	groups: {
		gameGroupId: string;
		id: string;
		name: string;
		variants: { id: string; label: string; shortLabel: string | null }[];
	}[];
	id: string;
}

export type LineupMap = Record<string, LineupOutput>;

const LOOKUP_CHUNK_EXTRA_PARAMS = 1;

const GAME_FORBIDDEN = "You do not own this game";

function forbidden(): TRPCError {
	return new TRPCError({ code: "FORBIDDEN", message: GAME_FORBIDDEN });
}

function badRequest(message: string): TRPCError {
	return new TRPCError({ code: "BAD_REQUEST", message });
}

function lineupSignature(lineup: PendingShape): string {
	return JSON.stringify([
		lineup.gameMixId,
		lineup.groups.map((group) => [group.gameGroupId, group.variantIds]),
	]);
}

function byPosition(
	left: { position: number },
	right: { position: number }
): number {
	return left.position - right.position;
}

function bucket<Row>(
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

export async function loadLineups(
	db: Database,
	userId: string,
	ids: Iterable<string>
): Promise<Map<string, Lineup>> {
	const unique = [...new Set(ids)];
	if (unique.length === 0) {
		return new Map();
	}
	const lineups = await selectInChunks(
		unique,
		(chunk) =>
			db
				.select({ id: gameLineup.id, gameMixId: gameLineup.gameMixId })
				.from(gameLineup)
				.where(
					and(eq(gameLineup.userId, userId), inArray(gameLineup.id, chunk))
				),
		LOOKUP_CHUNK_EXTRA_PARAMS
	);
	const ownedIds = lineups.map((lineup) => lineup.id);
	const [groups, variants] = await Promise.all([
		selectInChunks(
			ownedIds,
			(chunk) =>
				db
					.select({
						id: gameLineupGroup.id,
						lineupId: gameLineupGroup.lineupId,
						position: gameLineupGroup.position,
						gameGroupId: gameLineupGroup.gameGroupId,
						name: gameLineupGroup.name,
					})
					.from(gameLineupGroup)
					.where(
						and(
							eq(gameLineupGroup.userId, userId),
							inArray(gameLineupGroup.lineupId, chunk)
						)
					),
			LOOKUP_CHUNK_EXTRA_PARAMS
		),
		selectInChunks(
			ownedIds,
			(chunk) =>
				db
					.select({
						lineupGroupId: gameLineupVariant.lineupGroupId,
						variantId: gameLineupVariant.variantId,
						position: gameLineupVariant.position,
					})
					.from(gameLineupVariant)
					.where(
						and(
							eq(gameLineupVariant.userId, userId),
							inArray(gameLineupVariant.lineupId, chunk)
						)
					),
			LOOKUP_CHUNK_EXTRA_PARAMS
		),
	]);
	const groupsByLineup = bucket(groups, (group) => group.lineupId);
	const variantsByGroup = bucket(variants, (variant) => variant.lineupGroupId);
	return new Map(
		lineups.map((lineup) => [
			lineup.id,
			{
				id: lineup.id,
				gameMixId: lineup.gameMixId,
				groups: (groupsByLineup.get(lineup.id) ?? [])
					.toSorted(byPosition)
					.map((group) => ({
						id: group.id,
						gameGroupId: group.gameGroupId,
						name: group.name,
						variantIds: (variantsByGroup.get(group.id) ?? [])
							.toSorted(byPosition)
							.map((variant) => variant.variantId),
					})),
			},
		])
	);
}

export async function findBuiltinVariantId(
	db: Database,
	userId: string,
	builtinKey: string
): Promise<string | null> {
	const [found] = await db
		.select({ id: gameVariant.id })
		.from(gameVariant)
		.where(
			and(
				eq(gameVariant.userId, userId),
				eq(gameVariant.builtinKey, builtinKey)
			)
		)
		.limit(1);
	return found?.id ?? null;
}

export async function resolveDefaultGame(
	db: Database,
	userId: string,
	game: GameInput | undefined,
	hasCurrent: boolean,
	missingGameMessage: string
): Promise<GameInput | undefined> {
	if (game || hasCurrent) {
		return game;
	}
	await seedDefaultGameData(db, userId);
	const nlhId = await findBuiltinVariantId(db, userId, "nlh");
	if (!nlhId) {
		throw new TRPCError({ code: "BAD_REQUEST", message: missingGameMessage });
	}
	return { variantId: nlhId };
}

interface PendingShape {
	gameMixId: string | null;
	groups: { gameGroupId: string; variantIds: string[] }[];
}

export class LineupPlanner {
	private readonly candidates = new Map<string, Lineup>();
	private readonly created: Lineup[] = [];
	private readonly lineups = new Map<string, Lineup>();
	private readonly mixShapes = new Map<string, PendingShape>();
	private readonly variantGroups = new Map<string, string>();
	private readonly db: Database;
	private readonly userId: string;

	constructor(db: Database, userId: string) {
		this.db = db;
		this.userId = userId;
	}

	addCandidates(lineups: Iterable<Lineup>): void {
		for (const lineup of lineups) {
			this.lineups.set(lineup.id, lineup);
			const signature = lineupSignature(lineup);
			if (!this.candidates.has(signature)) {
				this.candidates.set(signature, lineup);
			}
		}
	}

	async prepare(inputs: GameInput[]): Promise<void> {
		const variantIds = new Set<string>();
		const mixIds = new Set<string>();
		const lineupIds = new Set<string>();
		for (const input of inputs) {
			if ("variantId" in input) {
				variantIds.add(input.variantId);
			} else if ("gameMixId" in input) {
				mixIds.add(input.gameMixId);
			} else if (!this.lineups.has(input.lineupId)) {
				lineupIds.add(input.lineupId);
			}
		}
		await Promise.all([
			this.prepareVariants(variantIds),
			this.prepareMixes(mixIds),
			this.prepareLineups(lineupIds),
		]);
	}

	resolve(input: GameInput): Lineup {
		if ("lineupId" in input) {
			const found = this.lineups.get(input.lineupId);
			if (!found) {
				throw forbidden();
			}
			return found;
		}
		const shape =
			"variantId" in input
				? this.variantShape(input.variantId)
				: this.mixShapes.get(input.gameMixId);
		if (!shape) {
			throw forbidden();
		}
		return this.lineupFor(shape);
	}

	statements(): BatchStatement[] {
		const lineupRows = this.created.map((lineup) => ({
			id: lineup.id,
			userId: this.userId,
			gameMixId: lineup.gameMixId,
		}));
		const groupRows = this.created.flatMap((lineup) =>
			lineup.groups.map((group, position) => ({
				id: group.id,
				userId: this.userId,
				lineupId: lineup.id,
				position,
				gameGroupId: group.gameGroupId,
				name: group.name,
			}))
		);
		const variantRows = this.created.flatMap((lineup) =>
			lineup.groups.flatMap((group) =>
				group.variantIds.map((variantId, position) => ({
					userId: this.userId,
					lineupId: lineup.id,
					lineupGroupId: group.id,
					variantId,
					position,
				}))
			)
		);
		return [
			...insertChunks(lineupRows, (chunk) =>
				this.db.insert(gameLineup).values(chunk)
			),
			...insertChunks(groupRows, (chunk) =>
				this.db.insert(gameLineupGroup).values(chunk)
			),
			...insertChunks(variantRows, (chunk) =>
				this.db.insert(gameLineupVariant).values(chunk)
			),
		];
	}

	private lineupFor(shape: PendingShape): Lineup {
		const signature = lineupSignature(shape);
		const existing = this.candidates.get(signature);
		if (existing) {
			return existing;
		}
		if (shape.groups.length > MAX_LINEUP_GROUPS) {
			throw badRequest(
				`A game may have at most ${MAX_LINEUP_GROUPS} blind structures`
			);
		}
		const lineup: Lineup = {
			id: crypto.randomUUID(),
			gameMixId: shape.gameMixId,
			groups: shape.groups.map((group) => ({
				id: crypto.randomUUID(),
				gameGroupId: group.gameGroupId,
				name: null,
				variantIds: group.variantIds,
			})),
		};
		this.created.push(lineup);
		this.candidates.set(signature, lineup);
		this.lineups.set(lineup.id, lineup);
		return lineup;
	}

	private variantShape(variantId: string): PendingShape | undefined {
		const gameGroupId = this.variantGroups.get(variantId);
		if (gameGroupId === undefined) {
			return undefined;
		}
		return {
			gameMixId: null,
			groups: [{ gameGroupId, variantIds: [variantId] }],
		};
	}

	private async prepareVariants(ids: Set<string>): Promise<void> {
		if (ids.size === 0) {
			return;
		}
		const rows = await selectInChunks(
			[...ids],
			(chunk) =>
				this.db
					.select({
						id: gameVariant.id,
						groupId: gameVariant.groupId,
						archivedAt: gameVariant.archivedAt,
						groupArchivedAt: gameGroup.archivedAt,
					})
					.from(gameVariant)
					.innerJoin(
						gameGroup,
						and(
							eq(gameGroup.id, gameVariant.groupId),
							eq(gameGroup.userId, gameVariant.userId)
						)
					)
					.where(
						and(
							eq(gameVariant.userId, this.userId),
							inArray(gameVariant.id, chunk)
						)
					),
			LOOKUP_CHUNK_EXTRA_PARAMS
		);
		if (rows.length !== ids.size) {
			throw forbidden();
		}
		if (
			rows.some(
				(row) => row.archivedAt !== null || row.groupArchivedAt !== null
			)
		) {
			throw badRequest(
				"An archived game variant cannot be newly selected; restore it first"
			);
		}
		for (const row of rows) {
			this.variantGroups.set(row.id, row.groupId);
		}
	}

	private async prepareMixes(ids: Set<string>): Promise<void> {
		if (ids.size === 0) {
			return;
		}
		const mixIds = [...ids];
		const mixes = await selectInChunks(
			mixIds,
			(chunk) =>
				this.db
					.select({ id: gameMix.id, archivedAt: gameMix.archivedAt })
					.from(gameMix)
					.where(
						and(eq(gameMix.userId, this.userId), inArray(gameMix.id, chunk))
					),
			LOOKUP_CHUNK_EXTRA_PARAMS
		);
		if (mixes.length !== ids.size) {
			throw forbidden();
		}
		if (mixes.some((mix) => mix.archivedAt !== null)) {
			throw badRequest(
				"An archived game mix cannot be newly selected; restore it first"
			);
		}
		const members = await selectInChunks(
			mixIds,
			(chunk) =>
				this.db
					.select({
						mixId: gameMixVariant.mixId,
						position: gameMixVariant.position,
						variantId: gameMixVariant.variantId,
						groupId: gameVariant.groupId,
						variantArchivedAt: gameVariant.archivedAt,
						groupArchivedAt: gameGroup.archivedAt,
					})
					.from(gameMixVariant)
					.innerJoin(
						gameVariant,
						and(
							eq(gameVariant.id, gameMixVariant.variantId),
							eq(gameVariant.userId, gameMixVariant.userId)
						)
					)
					.innerJoin(
						gameGroup,
						and(
							eq(gameGroup.id, gameVariant.groupId),
							eq(gameGroup.userId, gameVariant.userId)
						)
					)
					.where(
						and(
							eq(gameMixVariant.userId, this.userId),
							inArray(gameMixVariant.mixId, chunk)
						)
					),
			LOOKUP_CHUNK_EXTRA_PARAMS
		);
		const membersByMix = bucket(members, (member) => member.mixId);
		for (const mixId of mixIds) {
			const ordered = (membersByMix.get(mixId) ?? []).toSorted(byPosition);
			if (ordered.length === 0) {
				throw badRequest("A game mix without games cannot be selected");
			}
			if (
				ordered.some(
					(member) =>
						member.variantArchivedAt !== null || member.groupArchivedAt !== null
				)
			) {
				throw badRequest(
					"An archived game cannot be newly selected; restore it first"
				);
			}
			const groups: PendingShape["groups"] = [];
			for (const member of ordered) {
				const group = groups.find(
					(candidate) => candidate.gameGroupId === member.groupId
				);
				if (group) {
					group.variantIds.push(member.variantId);
				} else {
					groups.push({
						gameGroupId: member.groupId,
						variantIds: [member.variantId],
					});
				}
			}
			this.mixShapes.set(mixId, { gameMixId: mixId, groups });
		}
	}

	private async prepareLineups(ids: Set<string>): Promise<void> {
		if (ids.size === 0) {
			return;
		}
		const loaded = await loadLineups(this.db, this.userId, ids);
		if (loaded.size !== ids.size) {
			throw forbidden();
		}
		this.addCandidates(loaded.values());
	}
}

function lineupDisplayName(
	lineup: Lineup,
	mixLabels: Map<string, string>,
	variants: Map<string, { label: string; shortLabel: string | null }>
): string {
	const mixLabel = lineup.gameMixId
		? mixLabels.get(lineup.gameMixId)
		: undefined;
	if (mixLabel !== undefined) {
		return mixLabel;
	}
	const variantIds = lineup.groups.flatMap((group) => group.variantIds);
	const [onlyVariantId] = variantIds;
	if (lineup.groups.length === 1 && variantIds.length === 1 && onlyVariantId) {
		return variants.get(onlyVariantId)?.label ?? "";
	}
	return variantIds
		.map((id) => {
			const variant = variants.get(id);
			return variant ? (variant.shortLabel ?? variant.label) : "";
		})
		.join(" / ");
}

export async function hydrateLineups(
	db: Database,
	userId: string,
	ids: Iterable<string>
): Promise<LineupMap> {
	const lineups = await loadLineups(db, userId, ids);
	const variantIds = new Set<string>();
	const gameGroupIds = new Set<string>();
	const mixIds = new Set<string>();
	for (const lineup of lineups.values()) {
		if (lineup.gameMixId) {
			mixIds.add(lineup.gameMixId);
		}
		for (const group of lineup.groups) {
			gameGroupIds.add(group.gameGroupId);
			for (const variantId of group.variantIds) {
				variantIds.add(variantId);
			}
		}
	}
	const [variantRows, groupRows, mixRows] = await Promise.all([
		selectInChunks(
			[...variantIds],
			(chunk) =>
				db
					.select({
						id: gameVariant.id,
						label: gameVariant.label,
						shortLabel: gameVariant.shortLabel,
					})
					.from(gameVariant)
					.where(
						and(eq(gameVariant.userId, userId), inArray(gameVariant.id, chunk))
					),
			LOOKUP_CHUNK_EXTRA_PARAMS
		),
		selectInChunks(
			[...gameGroupIds],
			(chunk) =>
				db
					.select({ id: gameGroup.id, label: gameGroup.label })
					.from(gameGroup)
					.where(
						and(eq(gameGroup.userId, userId), inArray(gameGroup.id, chunk))
					),
			LOOKUP_CHUNK_EXTRA_PARAMS
		),
		selectInChunks(
			[...mixIds],
			(chunk) =>
				db
					.select({ id: gameMix.id, label: gameMix.label })
					.from(gameMix)
					.where(and(eq(gameMix.userId, userId), inArray(gameMix.id, chunk))),
			LOOKUP_CHUNK_EXTRA_PARAMS
		),
	]);
	const variants = new Map(
		variantRows.map((row) => [
			row.id,
			{ label: row.label, shortLabel: row.shortLabel },
		])
	);
	const groupLabels = new Map(groupRows.map((row) => [row.id, row.label]));
	const mixLabels = new Map(mixRows.map((row) => [row.id, row.label]));
	const map: LineupMap = {};
	for (const lineup of lineups.values()) {
		const structureTotals = new Map<string, number>();
		for (const group of lineup.groups) {
			structureTotals.set(
				group.gameGroupId,
				(structureTotals.get(group.gameGroupId) ?? 0) + 1
			);
		}
		const structureSeen = new Map<string, number>();
		map[lineup.id] = {
			id: lineup.id,
			gameMixId: lineup.gameMixId,
			displayName: lineupDisplayName(lineup, mixLabels, variants),
			groups: lineup.groups.map((group) => {
				const occurrence = (structureSeen.get(group.gameGroupId) ?? 0) + 1;
				structureSeen.set(group.gameGroupId, occurrence);
				const structureLabel = groupLabels.get(group.gameGroupId) ?? "";
				const fallback =
					(structureTotals.get(group.gameGroupId) ?? 0) > 1
						? `${structureLabel} ${occurrence}`
						: structureLabel;
				return {
					id: group.id,
					gameGroupId: group.gameGroupId,
					name: group.name ?? fallback,
					variants: group.variantIds.map((id) => ({
						id,
						label: variants.get(id)?.label ?? "",
						shortLabel: variants.get(id)?.shortLabel ?? null,
					})),
				};
			}),
		};
	}
	return map;
}
