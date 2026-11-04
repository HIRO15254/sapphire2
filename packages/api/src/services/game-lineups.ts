import type { Database } from "@sapphire2/db";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import {
	gameLineup,
	gameLineupGroup,
	gameLineupVariant,
} from "@sapphire2/db/schema/game-lineup";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import {
	type BatchStatement,
	chunkForInsert,
	selectInChunks,
} from "../lib/batch";
import { validateOwnedIds } from "../lib/ownership";

const idSchema = z.string().min(1);
export const gameInputSchema = z.union([
	z.strictObject({ variantId: idSchema }),
	z.strictObject({ gameMixId: idSchema }),
	z.strictObject({ lineupId: idSchema }),
]);
export type GameInput = z.infer<typeof gameInputSchema>;
export interface Lineup {
	displayName: string;
	gameMixId: string | null;
	groups: {
		id: string;
		gameGroupId: string;
		name: string | null;
		variants: { id: string; label: string; shortLabel: string | null }[];
	}[];
	id: string;
}
export type LineupMap = Record<string, Lineup>;

export async function hydrateGameLineups(
	db: Database,
	userId: string,
	lineupIds: string[]
): Promise<LineupMap> {
	const ids = [...new Set(lineupIds)];
	const lineups = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select({
					id: gameLineup.id,
					gameMixId: gameLineup.gameMixId,
					mixLabel: gameMix.label,
				})
				.from(gameLineup)
				.leftJoin(
					gameMix,
					and(eq(gameMix.id, gameLineup.gameMixId), eq(gameMix.userId, userId))
				)
				.where(
					and(eq(gameLineup.userId, userId), inArray(gameLineup.id, chunk))
				),
		2
	);
	const groups = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select({
					id: gameLineupGroup.id,
					lineupId: gameLineupGroup.lineupId,
					gameGroupId: gameLineupGroup.gameGroupId,
					name: gameLineupGroup.name,
					position: gameLineupGroup.position,
					groupLabel: gameGroup.label,
				})
				.from(gameLineupGroup)
				.innerJoin(
					gameGroup,
					and(
						eq(gameGroup.id, gameLineupGroup.gameGroupId),
						eq(gameGroup.userId, userId)
					)
				)
				.where(
					and(
						eq(gameLineupGroup.userId, userId),
						inArray(gameLineupGroup.lineupId, chunk)
					)
				),
		2
	);
	const variants = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select({
					lineupGroupId: gameLineupVariant.lineupGroupId,
					position: gameLineupVariant.position,
					id: gameVariant.id,
					label: gameVariant.label,
					shortLabel: gameVariant.shortLabel,
				})
				.from(gameLineupVariant)
				.innerJoin(
					gameVariant,
					and(
						eq(gameVariant.id, gameLineupVariant.variantId),
						eq(gameVariant.userId, userId)
					)
				)
				.where(
					and(
						eq(gameLineupVariant.userId, userId),
						inArray(gameLineupVariant.lineupId, chunk)
					)
				),
		2
	);
	const result: LineupMap = {};
	for (const lineup of lineups) {
		const rows = groups
			.filter((group) => group.lineupId === lineup.id)
			.toSorted((a, b) => a.position - b.position);
		const counts = new Map<string, number>();
		for (const row of rows) {
			counts.set(row.gameGroupId, (counts.get(row.gameGroupId) ?? 0) + 1);
		}
		const occurrences = new Map<string, number>();
		const mapped = rows.map((row) => {
			const occurrence = (occurrences.get(row.gameGroupId) ?? 0) + 1;
			occurrences.set(row.gameGroupId, occurrence);
			return {
				id: row.id,
				gameGroupId: row.gameGroupId,
				name:
					row.name ??
					`${row.groupLabel}${(counts.get(row.gameGroupId) ?? 0) > 1 ? ` ${occurrence}` : ""}`,
				variants: variants
					.filter((variant) => variant.lineupGroupId === row.id)
					.toSorted((a, b) => a.position - b.position)
					.map(({ id, label, shortLabel }) => ({ id, label, shortLabel })),
			};
		});
		const firstGroup = mapped[0];
		const firstVariant = firstGroup?.variants[0];
		const displayName =
			lineup.mixLabel ??
			(mapped.length === 1 && firstGroup?.variants.length === 1 && firstVariant
				? firstVariant.label
				: mapped
						.flatMap((group) =>
							group.variants.map(
								(variant) => variant.shortLabel ?? variant.label
							)
						)
						.join(" / "));
		result[lineup.id] = {
			id: lineup.id,
			gameMixId: lineup.gameMixId,
			displayName,
			groups: mapped,
		};
	}
	return result;
}

function signature(lineup: Pick<Lineup, "gameMixId" | "groups">): string {
	return JSON.stringify([
		lineup.gameMixId,
		lineup.groups.map((group) => [
			group.gameGroupId,
			group.variants.map((variant) => variant.id),
		]),
	]);
}

export async function resolveGameLineup(
	db: Database,
	userId: string,
	game: GameInput | undefined,
	currentLineupId?: string
): Promise<{ lineup: Lineup; statements: BatchStatement[] }> {
	let current: Lineup | undefined;
	if (currentLineupId) {
		current = (await hydrateGameLineups(db, userId, [currentLineupId]))[
			currentLineupId
		];
	}
	if (!game && current) {
		return { lineup: current, statements: [] };
	}
	if (game && "lineupId" in game) {
		await validateOwnedIds(db, gameLineup, [game.lineupId], userId);
		const lineup = (await hydrateGameLineups(db, userId, [game.lineupId]))[
			game.lineupId
		];
		if (!lineup) {
			throw new TRPCError({ code: "FORBIDDEN" });
		}
		return { lineup, statements: [] };
	}
	return await assembleGameLineup(db, userId, game, current);
}

async function resolveSelection(
	db: Database,
	userId: string,
	game: Exclude<GameInput, { lineupId: string }> | undefined
): Promise<{
	mixId: string | null;
	mixLabel: string | null;
	mixArchived: boolean;
	variantIds: string[];
}> {
	let selected = game;
	if (!selected) {
		const [builtin] = await db
			.select({ id: gameVariant.id })
			.from(gameVariant)
			.where(
				and(eq(gameVariant.userId, userId), eq(gameVariant.builtinKey, "nlh"))
			)
			.limit(1);
		if (!builtin) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Builtin NLH is unavailable",
			});
		}
		selected = { variantId: builtin.id };
	}
	if ("variantId" in selected) {
		return {
			mixId: null,
			mixLabel: null,
			mixArchived: false,
			variantIds: [selected.variantId],
		};
	}
	await validateOwnedIds(db, gameMix, [selected.gameMixId], userId);
	const [mix] = await db
		.select({
			id: gameMix.id,
			label: gameMix.label,
			archivedAt: gameMix.archivedAt,
		})
		.from(gameMix)
		.where(and(eq(gameMix.id, selected.gameMixId), eq(gameMix.userId, userId)));
	if (!mix) {
		throw new TRPCError({ code: "FORBIDDEN" });
	}
	const members = await db
		.select({ id: gameMixVariant.variantId, position: gameMixVariant.position })
		.from(gameMixVariant)
		.where(
			and(eq(gameMixVariant.mixId, mix.id), eq(gameMixVariant.userId, userId))
		);
	return {
		mixId: mix.id,
		mixLabel: mix.label,
		mixArchived: mix.archivedAt !== null,
		variantIds: members
			.toSorted((a, b) => a.position - b.position)
			.map((member) => member.id),
	};
}

async function assembleGameLineup(
	db: Database,
	userId: string,
	game: Exclude<GameInput, { lineupId: string }> | undefined,
	current: Lineup | undefined
): Promise<{ lineup: Lineup; statements: BatchStatement[] }> {
	const { mixId, mixLabel, mixArchived, variantIds } = await resolveSelection(
		db,
		userId,
		game
	);
	await validateOwnedIds(db, gameVariant, variantIds, userId);
	const variants = await selectInChunks(
		variantIds,
		(chunk) =>
			db
				.select({
					id: gameVariant.id,
					label: gameVariant.label,
					shortLabel: gameVariant.shortLabel,
					groupId: gameVariant.groupId,
					archivedAt: gameVariant.archivedAt,
				})
				.from(gameVariant)
				.where(
					and(eq(gameVariant.userId, userId), inArray(gameVariant.id, chunk))
				),
		1
	);
	const firstVariant = variants[0];
	if (!firstVariant) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "A lineup must contain at least one game",
		});
	}
	const byId = new Map(variants.map((variant) => [variant.id, variant]));
	const groups = new Map<string, Lineup["groups"][number]>();
	for (const id of variantIds) {
		const variant = byId.get(id);
		if (!variant) {
			throw new TRPCError({ code: "FORBIDDEN" });
		}
		let group = groups.get(variant.groupId);
		if (!group) {
			group = {
				id: crypto.randomUUID(),
				gameGroupId: variant.groupId,
				name: null,
				variants: [],
			};
			groups.set(variant.groupId, group);
		}
		group.variants.push({
			id: variant.id,
			label: variant.label,
			shortLabel: variant.shortLabel,
		});
	}
	const lineup: Lineup = {
		id: crypto.randomUUID(),
		gameMixId: mixId,
		displayName: mixLabel ?? firstVariant.label,
		groups: [...groups.values()],
	};
	if (current && signature(current) === signature(lineup)) {
		return { lineup: current, statements: [] };
	}
	if (mixArchived || variants.some((variant) => variant.archivedAt !== null)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Archived games cannot be newly selected",
		});
	}
	return { lineup, statements: lineupInsertStatements(db, userId, lineup) };
}

function lineupInsertStatements(
	db: Database,
	userId: string,
	lineup: Lineup
): BatchStatement[] {
	const statements: BatchStatement[] = [
		db
			.insert(gameLineup)
			.values({ id: lineup.id, userId, gameMixId: lineup.gameMixId }),
	];
	const groupInserts = lineup.groups.map((group, position) => ({
		id: group.id,
		userId,
		lineupId: lineup.id,
		position,
		gameGroupId: group.gameGroupId,
		name: group.name,
	}));
	if (groupInserts[0]) {
		for (const chunk of chunkForInsert(
			groupInserts,
			Object.keys(groupInserts[0]).length
		)) {
			statements.push(db.insert(gameLineupGroup).values(chunk));
		}
	}
	const variantInserts = lineup.groups.flatMap((group) =>
		group.variants.map((variant, position) => ({
			userId,
			lineupId: lineup.id,
			lineupGroupId: group.id,
			variantId: variant.id,
			position,
		}))
	);
	if (variantInserts[0]) {
		for (const chunk of chunkForInsert(
			variantInserts,
			Object.keys(variantInserts[0]).length
		)) {
			statements.push(db.insert(gameLineupVariant).values(chunk));
		}
	}
	return statements;
}
