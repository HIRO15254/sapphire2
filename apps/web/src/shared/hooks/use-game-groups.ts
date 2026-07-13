import { MIX_VARIANT } from "@sapphire2/db/constants/game-variants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
	type MixGroupInfo,
	PENDING_GROUP_ID,
	type ResolveGroup,
} from "@/shared/lib/mix-games";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

/** Blind-slot labels of a group; blind3 null = no third slot. */
export interface BlindSlotLabels {
	blind1: string;
	blind2: string;
	blind3: string | null;
}

// Shown only while the master rows haven't loaded (or an account is mid-
// self-seed); the DB rows are the runtime source of truth, never constants.
const FALLBACK_LABELS: BlindSlotLabels = {
	blind1: "SB",
	blind2: "BB",
	blind3: "Straddle",
};

// The master lists change only through explicit edits, which all invalidate
// via useInvalidateGameMasters — a generous staleTime stops the three lists
// refetching on every mount/focus (c36).
export const GAME_MASTERS_STALE_TIME_MS = 5 * 60 * 1000;

interface GameGroupRowLike {
	blind1Label: string | null;
	blind2Label: string | null;
	blind3Label: string | null;
	builtinKey: string | null;
	id: string;
	label: string;
}

interface GameVariantRowLike {
	builtinKey: string | null;
	groupId: string;
	id: string;
	label: string;
	shortLabel: string | null;
	sortOrder: number;
}

interface GameMixRowLike {
	builtinKey: string | null;
	games: string[];
	id: string;
	label: string;
}

// Stable empty fallbacks so the memoized lookups don't rebuild every render
// while a list is still loading.
const NO_GROUPS: GameGroupRowLike[] = [];
const NO_VARIANTS: GameVariantRowLike[] = [];
const NO_MIXES: GameMixRowLike[] = [];

function normalizedLabel(value: string): string {
	return value.trim().toLowerCase();
}

function toInfo(row: GameGroupRowLike, sortIndex: number): MixGroupInfo {
	return {
		id: row.id,
		label: row.label,
		blind1Label: row.blind1Label ?? "SB",
		blind2Label: row.blind2Label ?? "BB",
		blind3Label: row.blind3Label,
		sortIndex,
	};
}

/**
 * Invalidate the three game-master lists together. Every mutation that
 * touches groups, variants, or mixes refetches all three as one unit (mix
 * composition summaries and label<->id mappings read across the lists), so
 * the uniform invalidation lives here instead of being re-declared per hook.
 */
export function useInvalidateGameMasters() {
	const queryClient = useQueryClient();
	const groupsKey = trpc.gameGroup.list.queryOptions().queryKey;
	const variantsKey = trpc.gameVariant.list.queryOptions().queryKey;
	const mixesKey = trpc.gameMix.list.queryOptions().queryKey;
	return () =>
		invalidateTargets(queryClient, [
			{ queryKey: groupsKey },
			{ queryKey: variantsKey },
			{ queryKey: mixesKey },
		]);
}

/**
 * The variant/group master data (per-user DB rows, seeded at signup).
 * Bundles both lists and exposes the resolution primitives every editor
 * and form uses: variant label → owning group, builtinKey → current
 * label, and group blind-slot labels for a variant. All derived lookups and
 * resolver callbacks are memoized on the three lists, so consumers can use
 * them as effect/memo dependencies without re-derivation loops (c37).
 */
export function useGameGroups() {
	const groupsQuery = useQuery({
		...trpc.gameGroup.list.queryOptions(),
		staleTime: GAME_MASTERS_STALE_TIME_MS,
	});
	const variantsQuery = useQuery({
		...trpc.gameVariant.list.queryOptions(),
		staleTime: GAME_MASTERS_STALE_TIME_MS,
	});
	const mixesQuery = useQuery({
		...trpc.gameMix.list.queryOptions(),
		staleTime: GAME_MASTERS_STALE_TIME_MS,
	});

	const groups = (groupsQuery.data ?? NO_GROUPS) as GameGroupRowLike[];
	const variants = (variantsQuery.data ?? NO_VARIANTS) as GameVariantRowLike[];
	const mixes = (mixesQuery.data ?? NO_MIXES) as GameMixRowLike[];

	// Server list order is canonical (builtin order, then customs by label).
	const infoById = useMemo(
		() =>
			new Map<string, MixGroupInfo>(
				groups.map((g, index) => [g.id, toInfo(g, index)])
			),
		[groups]
	);

	// First row wins on (theoretical) duplicate labels, matching the previous
	// Array.prototype.find semantics.
	const variantByNormalizedLabel = useMemo(() => {
		const map = new Map<string, GameVariantRowLike>();
		for (const row of variants) {
			const key = normalizedLabel(row.label);
			if (!map.has(key)) {
				map.set(key, row);
			}
		}
		return map;
	}, [variants]);

	const variantByLabel = useCallback(
		(label: string): GameVariantRowLike | undefined =>
			variantByNormalizedLabel.get(normalizedLabel(label)),
		[variantByNormalizedLabel]
	);

	const fallbackGroup = useMemo<MixGroupInfo>(() => {
		const bigbet =
			groups.find((g) => g.builtinKey === "bigbet") ?? groups.at(0);
		const info = bigbet ? infoById.get(bigbet.id) : undefined;
		return (
			info ?? {
				id: PENDING_GROUP_ID,
				label: "Big Bet",
				blind1Label: FALLBACK_LABELS.blind1,
				blind2Label: FALLBACK_LABELS.blind2,
				blind3Label: FALLBACK_LABELS.blind3,
				sortIndex: groups.length,
			}
		);
	}, [groups, infoById]);

	const groupFor: ResolveGroup = useCallback(
		(variantLabel) => {
			const row = variantByLabel(variantLabel);
			const info = row ? infoById.get(row.groupId) : undefined;
			return info ?? fallbackGroup;
		},
		[variantByLabel, infoById, fallbackGroup]
	);

	const labelsFor = useCallback(
		(variantLabel: string): BlindSlotLabels => {
			const row = variantByLabel(variantLabel);
			const info = row ? infoById.get(row.groupId) : undefined;
			if (!info) {
				return FALLBACK_LABELS;
			}
			return {
				blind1: info.blind1Label,
				blind2: info.blind2Label,
				blind3: info.blind3Label,
			};
		},
		[variantByLabel, infoById]
	);

	// First mix wins on duplicate labels, matching the previous find/some
	// semantics.
	const mixByNormalizedLabel = useMemo(() => {
		const map = new Map<string, GameMixRowLike>();
		for (const mix of mixes) {
			const key = normalizedLabel(mix.label);
			if (!map.has(key)) {
				map.set(key, mix);
			}
		}
		return map;
	}, [mixes]);

	// True for the legacy mix-mode key ("mix") or any of the caller's mix
	// master labels — both freeze into the same `variant` string once picked
	// (self-freezing select), so this is the single place that recognizes
	// either shape.
	const isMixValue = useCallback(
		(value: string): boolean => {
			const normalized = normalizedLabel(value);
			return normalized === MIX_VARIANT || mixByNormalizedLabel.has(normalized);
		},
		[mixByNormalizedLabel]
	);

	const variantLabelById = useMemo(
		() => new Map<string, string>(variants.map((row) => [row.id, row.label])),
		[variants]
	);

	// A mix's ordered `games` (variant ids) resolved to their current display
	// labels. Ids whose variant row no longer exists (deleted since the mix
	// was saved) are silently skipped rather than surfacing a hole in the
	// editor; an unknown mix label resolves to an empty composition.
	const mixCompositionLabels = useCallback(
		(mixLabel: string): string[] => {
			const mix = mixByNormalizedLabel.get(normalizedLabel(mixLabel));
			if (!mix) {
				return [];
			}
			return mix.games
				.map((id) => variantLabelById.get(id))
				.filter((label): label is string => label !== undefined);
		},
		[mixByNormalizedLabel, variantLabelById]
	);

	return {
		groups,
		variants,
		mixes,
		isLoading:
			groupsQuery.isLoading || variantsQuery.isLoading || mixesQuery.isLoading,
		groupFor,
		labelsFor,
		isMixValue,
		mixCompositionLabels,
	};
}
