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

export interface BlindSlotLabels {
	blind1: string;
	blind2: string;
	blind3: string | null;
}

const FALLBACK_LABELS: BlindSlotLabels = {
	blind1: "SB",
	blind2: "BB",
	blind3: "Straddle",
};

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

	const infoById = useMemo(
		() =>
			new Map<string, MixGroupInfo>(
				groups.map((g, index) => [g.id, toInfo(g, index)])
			),
		[groups]
	);

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
