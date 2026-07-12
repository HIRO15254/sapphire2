import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import z from "zod";
import type { RingGameFormValues } from "@/features/rooms/hooks/use-ring-games";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import { optionalNumericString } from "@/shared/lib/form-fields";
import {
	fromMixGames,
	type MixGameGroupRow,
	reseedFromLabels,
	rowsFromVariantLabels,
	toMixGames,
} from "@/shared/lib/mix-games";
import { trpc } from "@/utils/trpc";

interface MixMasterRow {
	builtinKey: string | null;
	games: string[];
	id: string;
	label: string;
}

type RingGameAnteType = "all" | "bb" | "none";

// mixGames rows are editor state only (uid, group metadata, string amount
// cells); the shared schema validates the actual submit payload server-side
// once toMixGames() strips the derived bucket metadata back down.
const ringGameFormSchema = z.object({
	name: z.string().min(1, "Game name is required"),
	variant: z.string().min(1),
	mixGames: z.array(z.custom<MixGameGroupRow>()),
	blind1: optionalNumericString({ integer: true, min: 0 }),
	blind2: optionalNumericString({ integer: true, min: 0 }),
	blind3: optionalNumericString({ integer: true, min: 0 }),
	ante: optionalNumericString({ integer: true, min: 0 }),
	anteType: z.enum(["all", "bb", "none"]),
	minBuyIn: optionalNumericString({ integer: true, min: 0 }),
	maxBuyIn: optionalNumericString({ integer: true, min: 0 }),
	tableSize: z.string(),
	currencyId: z.string(),
	memo: z.string(),
});

function numStrOrEmpty(value: number | undefined): string {
	return value === undefined ? "" : String(value);
}

function parseOptInt(value: string): number | undefined {
	if (value === "") {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

interface UseRingGameFormOptions {
	defaultValues?: RingGameFormValues;
	onSubmit: (values: RingGameFormValues) => void;
}

export function useRingGameForm({
	defaultValues,
	onSubmit,
}: UseRingGameFormOptions) {
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];
	const {
		groupFor,
		labelsFor,
		isLoading,
		isMixValue,
		mixCompositionLabels,
		mixes,
		variants,
	} = useGameGroups();
	const [editingMix, setEditingMix] = useState<MixMasterRow | null>(null);
	const [isMixSheetOpen, setIsMixSheetOpen] = useState(false);

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			variant: (defaultValues?.variant ?? DEFAULT_VARIANT_LABEL) as string,
			mixGames: fromMixGames(defaultValues?.mixGames ?? null, groupFor),
			blind1: numStrOrEmpty(defaultValues?.blind1),
			blind2: numStrOrEmpty(defaultValues?.blind2),
			blind3: numStrOrEmpty(defaultValues?.blind3),
			ante: numStrOrEmpty(defaultValues?.ante),
			anteType: (defaultValues?.anteType ?? "none") as RingGameAnteType,
			minBuyIn: numStrOrEmpty(defaultValues?.minBuyIn),
			maxBuyIn: numStrOrEmpty(defaultValues?.maxBuyIn),
			tableSize: defaultValues?.tableSize?.toString() ?? "",
			currencyId: defaultValues?.currencyId ?? "",
			memo: defaultValues?.memo ?? "",
		},
		onSubmit: ({ value }) => {
			const isAnteDisabled = value.anteType === "none";
			onSubmit({
				name: value.name,
				variant: value.variant || DEFAULT_VARIANT_LABEL,
				mixGames: isMixValue(value.variant) ? toMixGames(value.mixGames) : null,
				blind1: parseOptInt(value.blind1),
				blind2: parseOptInt(value.blind2),
				blind3: parseOptInt(value.blind3),
				ante: isAnteDisabled ? undefined : parseOptInt(value.ante),
				anteType: value.anteType,
				minBuyIn: parseOptInt(value.minBuyIn),
				maxBuyIn: parseOptInt(value.maxBuyIn),
				tableSize: parseOptInt(value.tableSize),
				currencyId: value.currencyId || undefined,
				memo: value.memo ? value.memo : undefined,
			});
		},
		validators: {
			onSubmit: ringGameFormSchema,
		},
	});

	// Picking a mix master reseeds the editor from its saved composition
	// (overwriting whatever was there — switching mixes starts fresh). The
	// legacy "mix" mode key has no composition to seed from, so it only sets
	// the field.
	const onVariantChange = (next: string) => {
		form.setFieldValue("variant", next);
		if (isMixValue(next) && next !== "mix") {
			form.setFieldValue(
				"mixGames",
				rowsFromVariantLabels(mixCompositionLabels(next), groupFor)
			);
		}
	};

	// The mix master row backing a frozen variant label — null for plain
	// variants and the legacy "mix" key (which has no master to edit).
	const mixRowFor = (variantLabel: string): MixMasterRow | null => {
		const normalized = variantLabel.trim().toLowerCase();
		return (
			(mixes as MixMasterRow[]).find(
				(m) => m.label.trim().toLowerCase() === normalized
			) ?? null
		);
	};

	// Composition edits go through the master (dedicated bottom sheet), never
	// inline: the editor shows amounts only. Saving the master renames the
	// frozen variant label if needed and re-derives the buckets, keeping the
	// amounts of groups that survive.
	const onEditMix = (variantLabel: string) => {
		const row = mixRowFor(variantLabel);
		if (!row) {
			return;
		}
		setEditingMix(row);
		setIsMixSheetOpen(true);
	};

	const onMixSaved = (mix: { id: string; label: string; games: string[] }) => {
		const labelById = new Map(variants.map((v) => [v.id, v.label]));
		const labels = mix.games
			.map((id) => labelById.get(id))
			.filter((label): label is string => label !== undefined);
		form.setFieldValue("variant", mix.label);
		form.setFieldValue(
			"mixGames",
			reseedFromLabels(form.state.values.mixGames, labels, groupFor)
		);
		setIsMixSheetOpen(false);
	};

	return {
		form,
		currencies,
		editingMix,
		groupFor,
		labelsFor,
		isMasterLoading: isLoading,
		isMixSheetOpen,
		isMixValue,
		mixRowFor,
		onEditMix,
		onMixSaved,
		onVariantChange,
		setIsMixSheetOpen,
		variants,
	};
}
