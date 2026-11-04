import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_VARIANT_LABEL,
	MIX_VARIANT,
} from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import type { MixGameGroup } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { protectedProcedure } from "../index";
import { compareBuiltinFirst } from "../routers/_game-masters";
import { listOwnedGameMixes } from "./game-mix";
import { assertSingleStructurePerGroup } from "./game-structure";

const CANONICAL_GAME_GROUP_ORDER = new Map<string, number>(
	DEFAULT_GAME_GROUPS.map((group, index) => [group.key, index])
);
const compareCanonicalGameGroups = compareBuiltinFirst(
	CANONICAL_GAME_GROUP_ORDER
);

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

interface CashRuleSelection {
	mixGames: MixGameGroup[] | null;
	variant: string;
}

interface ReconciledCashRuleSelection extends CashRuleSelection {
	shouldWriteMixGames: boolean;
}

interface CashMixFlatFieldClearPatch {
	ante: null;
	anteType: null;
	blind1: null;
	blind2: null;
	blind3: null;
}

export function cashMixFlatFieldClearPatch(
	mixGames: MixGameGroup[] | null
): Partial<CashMixFlatFieldClearPatch> {
	return mixGames === null
		? {}
		: {
				blind1: null,
				blind2: null,
				blind3: null,
				ante: null,
				anteType: null,
			};
}

function normalizedGameLabel(value: string): string {
	return value.trim().toLowerCase();
}

async function findOwnedNamedMix(
	db: DbInstance,
	userId: string,
	label: string
): Promise<{ games: string[]; label: string; userId: string } | undefined> {
	const rows = await listOwnedGameMixes(db, userId);
	const normalized = normalizedGameLabel(label);
	return rows.find(
		(row) =>
			row.userId === userId && normalizedGameLabel(row.label) === normalized
	);
}

interface OwnedGameVariantRow {
	groupId: string;
	id: string;
	label: string;
	userId: string;
}

interface OwnedGameGroupRow {
	builtinKey: string | null;
	id: string;
	label: string;
	userId: string;
}

async function ownedGameVariantRows(
	db: DbInstance,
	userId: string
): Promise<OwnedGameVariantRow[]> {
	const rows = await db
		.select({
			groupId: gameVariant.groupId,
			id: gameVariant.id,
			label: gameVariant.label,
			userId: gameVariant.userId,
		})
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));
	return rows.filter((row) => row.userId === userId);
}

async function ownedGameGroupRows(
	db: DbInstance,
	userId: string
): Promise<OwnedGameGroupRow[]> {
	const rows = await db
		.select({
			builtinKey: gameGroup.builtinKey,
			id: gameGroup.id,
			label: gameGroup.label,
			userId: gameGroup.userId,
		})
		.from(gameGroup)
		.where(eq(gameGroup.userId, userId));
	return rows.filter((row) => row.userId === userId);
}

function mixVariantLabelSet(mixGames: MixGameGroup[] | null): Set<string> {
	return new Set(
		(mixGames ?? []).flatMap((group) => group.variants.map(normalizedGameLabel))
	);
}

function normalizedMixVariantBuckets(mixGames: MixGameGroup[]): string[][] {
	return mixGames.map((group) => group.variants.map(normalizedGameLabel));
}

function orderedBucketsEqual(left: string[][], right: string[][]): boolean {
	return (
		left.length === right.length &&
		left.every(
			(bucket, index) =>
				bucket.length === right[index]?.length &&
				bucket.every(
					(label, labelIndex) => label === right[index]?.[labelIndex]
				)
		)
	);
}

function hasSameFrozenMixStructure(
	left: MixGameGroup[] | null,
	right: MixGameGroup[] | null
): boolean {
	return (
		left !== null &&
		right !== null &&
		orderedBucketsEqual(
			normalizedMixVariantBuckets(left),
			normalizedMixVariantBuckets(right)
		)
	);
}

function throwInvalidMixReference(): never {
	throw new TRPCError({
		code: "BAD_REQUEST",
		message: "The mixed-game definition references an unavailable game master",
	});
}

async function assertLegacyMixVariantsOwned(
	db: DbInstance,
	userId: string,
	mixGames: MixGameGroup[],
	frozenMixGames: MixGameGroup[] | null
): Promise<void> {
	const frozenLabels = mixVariantLabelSet(frozenMixGames);
	const ownedLabels = new Set(
		(await ownedGameVariantRows(db, userId)).map((row) =>
			normalizedGameLabel(row.label)
		)
	);
	for (const label of mixVariantLabelSet(mixGames)) {
		if (!(frozenLabels.has(label) || ownedLabels.has(label))) {
			throwInvalidMixReference();
		}
	}
}

async function assertNamedMixComposition(
	db: DbInstance,
	userId: string,
	mix: { games: string[] },
	mixGames: MixGameGroup[]
): Promise<void> {
	const ownedVariants = await ownedGameVariantRows(db, userId);
	const variantById = new Map(ownedVariants.map((row) => [row.id, row]));
	const orderedVariants = mix.games.map((id) => variantById.get(id));
	if (orderedVariants.some((variant) => variant === undefined)) {
		throwInvalidMixReference();
	}

	const ownedGroups = await ownedGameGroupRows(db, userId);
	const groupById = new Map(ownedGroups.map((row) => [row.id, row]));
	const bucketsByGroupId = new Map<
		string,
		{ group: OwnedGameGroupRow; labels: string[] }
	>();
	for (const variant of orderedVariants) {
		if (!variant) {
			throwInvalidMixReference();
		}
		const group = groupById.get(variant.groupId);
		if (!group) {
			throwInvalidMixReference();
		}
		const existing = bucketsByGroupId.get(variant.groupId);
		if (existing) {
			existing.labels.push(normalizedGameLabel(variant.label));
		} else {
			bucketsByGroupId.set(variant.groupId, {
				group,
				labels: [normalizedGameLabel(variant.label)],
			});
		}
	}

	const expectedBuckets = [...bucketsByGroupId.values()]
		.sort((left, right) => {
			return compareCanonicalGameGroups(left.group, right.group);
		})
		.map((bucket) => bucket.labels);
	if (
		!orderedBucketsEqual(expectedBuckets, normalizedMixVariantBuckets(mixGames))
	) {
		throwInvalidMixReference();
	}
}

function isSameFrozenNamedMix(
	variant: string,
	currentVariant: string,
	mixGames: MixGameGroup[] | null,
	currentMixGames: MixGameGroup[] | null
): boolean {
	return (
		normalizedGameLabel(variant) === normalizedGameLabel(currentVariant) &&
		hasSameFrozenMixStructure(mixGames, currentMixGames)
	);
}

async function isValidMixedVariant(
	db: DbInstance,
	userId: string,
	variant: string,
	mixGames: MixGameGroup[] | null,
	currentVariant: string,
	currentMixGames: MixGameGroup[] | null
): Promise<boolean> {
	const normalizedVariant = normalizedGameLabel(variant);
	const sameVariant = normalizedVariant === normalizedGameLabel(currentVariant);
	if (normalizedVariant === MIX_VARIANT) {
		if (mixGames !== null) {
			await assertLegacyMixVariantsOwned(
				db,
				userId,
				mixGames,
				sameVariant ? currentMixGames : null
			);
			await assertSingleStructurePerGroup(
				db,
				userId,
				mixGames,
				currentMixGames ?? []
			);
		}
		return true;
	}
	const namedMix = await findOwnedNamedMix(db, userId, variant);
	if (!namedMix) {
		if (sameVariant && currentMixGames !== null) {
			if (mixGames === null) {
				return true;
			}
			if (
				isSameFrozenNamedMix(variant, currentVariant, mixGames, currentMixGames)
			) {
				return true;
			}
			throwInvalidMixReference();
		}
		return false;
	}
	if (mixGames !== null) {
		await assertNamedMixComposition(db, userId, namedMix, mixGames);
	}
	return true;
}

export async function reconcileCashRuleSelection(
	db: DbInstance,
	userId: string,
	current: Partial<CashRuleSelection> | undefined,
	patch: { mixGames?: MixGameGroup[] | null; variant?: string }
): Promise<ReconciledCashRuleSelection> {
	const currentVariant = current?.variant ?? DEFAULT_VARIANT_LABEL;
	const currentMixGames = current?.mixGames ?? null;
	if (patch.variant === undefined && patch.mixGames === undefined) {
		return {
			variant: currentVariant,
			mixGames: currentMixGames,
			shouldWriteMixGames: false,
		};
	}
	const variant = patch.variant ?? currentVariant;
	const variantChanged =
		patch.variant !== undefined &&
		normalizedGameLabel(variant) !== normalizedGameLabel(currentVariant);
	let mixGames = variantChanged ? null : currentMixGames;
	if (patch.mixGames !== undefined) {
		mixGames = patch.mixGames;
	}

	const isMixedVariant = await isValidMixedVariant(
		db,
		userId,
		variant,
		mixGames,
		currentVariant,
		currentMixGames
	);

	if (isMixedVariant && mixGames === null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "A mixed-game variant requires mixGames",
		});
	}
	if (!isMixedVariant && mixGames !== null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "mixGames can only be used with a mixed-game variant",
		});
	}

	return {
		variant,
		mixGames,
		shouldWriteMixGames:
			patch.mixGames !== undefined ||
			(variantChanged && currentMixGames !== null),
	};
}
