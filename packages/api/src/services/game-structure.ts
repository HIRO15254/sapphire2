import type { Database } from "@sapphire2/db";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { blindLevel } from "@sapphire2/db/schema/tournament";
import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

interface VariantGroup {
	variants: string[];
}

function normalizedLabel(value: string): string {
	return value.trim().toLowerCase();
}

function isInsideFrozenGroup(
	group: VariantGroup,
	frozenLabelSets: Set<string>[]
): boolean {
	const labels = group.variants.map(normalizedLabel);
	return frozenLabelSets.some((frozen) =>
		labels.every((label) => frozen.has(label))
	);
}

function levelGameGroups(
	levels: { games?: LevelGameGroup[] | null }[]
): LevelGameGroup[] {
	return levels.flatMap((level) => level.games ?? []);
}

async function storedLevelGroups(
	db: Database,
	source: FrozenLevelSource
): Promise<LevelGameGroup[]> {
	const groups: LevelGameGroup[] = [];
	if (source.sessionId) {
		const rows = await db
			.select({ games: sessionBlindLevel.games })
			.from(sessionBlindLevel)
			.where(eq(sessionBlindLevel.sessionId, source.sessionId));
		groups.push(...levelGameGroups(rows));
	}
	if (source.tournamentId) {
		const rows = await db
			.select({ games: blindLevel.games })
			.from(blindLevel)
			.where(eq(blindLevel.tournamentId, source.tournamentId));
		groups.push(...levelGameGroups(rows));
	}
	return groups;
}

interface FrozenLevelSource {
	sessionId?: string | null;
	tournamentId?: string | null;
}

export async function assertSingleStructurePerGroup(
	db: Database,
	userId: string,
	groups: VariantGroup[],
	frozenGroups: VariantGroup[]
): Promise<void> {
	const frozenLabelSets = frozenGroups.map(
		(group) => new Set(group.variants.map(normalizedLabel))
	);
	const candidates = groups.filter(
		(group) =>
			group.variants.length > 1 && !isInsideFrozenGroup(group, frozenLabelSets)
	);
	if (candidates.length === 0) {
		return;
	}

	const variants = await db
		.select({ groupId: gameVariant.groupId, label: gameVariant.label })
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));
	const structureByLabel = new Map<string, string>();
	for (const variant of variants) {
		const key = normalizedLabel(variant.label);
		if (!structureByLabel.has(key)) {
			structureByLabel.set(key, variant.groupId);
		}
	}

	for (const group of candidates) {
		let first: { label: string; structure: string } | null = null;
		for (const label of group.variants) {
			const structure = structureByLabel.get(normalizedLabel(label));
			if (structure === undefined) {
				continue;
			}
			if (first === null) {
				first = { label, structure };
			} else if (first.structure !== structure) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Games in one mix group must share a game group: "${first.label}" and "${label}" belong to different game groups`,
				});
			}
		}
	}
}

export async function assertLevelGameStructures(
	db: Database,
	userId: string,
	levels: { games?: LevelGameGroup[] | null }[] | undefined,
	frozenSource: FrozenLevelSource
): Promise<void> {
	const groups = levelGameGroups(levels ?? []);
	if (groups.every((group) => group.variants.length < 2)) {
		return;
	}
	await assertSingleStructurePerGroup(
		db,
		userId,
		groups,
		await storedLevelGroups(db, frozenSource)
	);
}
