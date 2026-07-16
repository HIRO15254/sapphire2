import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import z from "zod";
import type { RingGameFormValues } from "@/features/rooms/hooks/use-ring-games";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import { useMixMasterEditing } from "@/shared/hooks/use-mix-master-editing";
import {
	optionalNumericString,
	parseOptionalInt,
} from "@/shared/lib/form-fields";
import {
	fromMixGames,
	MIX_AMOUNT_SLOTS,
	type MixGameGroupRow,
	mixCellError,
	rowsFromVariantLabels,
	toMixGames,
} from "@/shared/lib/mix-games";
import { trpc } from "@/utils/trpc";

type RingGameAnteType = "all" | "bb" | "none";

// mixGames rows are editor state only (uid, group metadata, string amount
// cells); the shared schema validates the actual submit payload server-side
// once toMixGames() strips the derived bucket metadata back down. The
// per-cell superRefine mirrors the server's `.int().min(0)` so invalid text
// blocks the submit with a field error instead of being coerced to null by
// cellToInt (c31).
const ringGameFormSchema = z.object({
	name: z.string().min(1, "Game name is required"),
	variant: z.string().min(1),
	mixGames: z.array(z.custom<MixGameGroupRow>()).superRefine((rows, ctx) => {
		for (const [rowIndex, row] of rows.entries()) {
			for (const slot of MIX_AMOUNT_SLOTS) {
				const message = mixCellError(row[slot]);
				if (message) {
					ctx.addIssue({ code: "custom", message, path: [rowIndex, slot] });
				}
			}
		}
	}),
	blind1: optionalNumericString({ integer: true, min: 0 }),
	blind2: optionalNumericString({ integer: true, min: 0 }),
	blind3: optionalNumericString({ integer: true, min: 0 }),
	ante: optionalNumericString({ integer: true, min: 0 }),
	anteType: z.enum(["all", "bb", "none"]),
	minBuyIn: optionalNumericString({ integer: true, min: 0 }),
	maxBuyIn: optionalNumericString({ integer: true, min: 0 }),
	tableSize: optionalNumericString({ integer: true, min: 2, max: 10 }),
	currencyId: z.string(),
	memo: z.string(),
});

function numStrOrEmpty(value: number | undefined): string {
	return value === undefined ? "" : String(value);
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
		isMixValue,
		mixCompositionLabels,
		mixes,
		variants,
	} = useGameGroups();
	// Seeded once per mount (RingGameForm gates mounting on loaded masters,
	// so the resolver is authoritative here). Recomputing per render would
	// hand the form new row identities (uids) every render and reset the
	// pristine editor state (c24).
	const [initialMixGames] = useState(() =>
		fromMixGames(defaultValues?.mixGames ?? null, groupFor)
	);

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			variant: (defaultValues?.variant ?? DEFAULT_VARIANT_LABEL) as string,
			mixGames: initialMixGames,
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
			// Gate on the editor state, never a live master lookup: a deleted or
			// renamed mix master must not wipe the frozen snapshot on an
			// unrelated edit (c02/c02b).
			const mixGames =
				value.mixGames.length > 0 ? toMixGames(value.mixGames) : null;
			const hasMixGames = mixGames !== null;
			const isAnteDisabled = value.anteType === "none";
			// Belt-and-braces against a stale third blind the current variant's
			// group cannot hold (c03) — onVariantChange also clears the field.
			const hasThirdSlot = labelsFor(value.variant).blind3 !== null;
			onSubmit({
				name: value.name,
				variant: value.variant || DEFAULT_VARIANT_LABEL,
				mixGames,
				// A mix submit carries its amounts inside mixGames; the flat
				// fields must go out empty, not with stale pre-switch values (c04).
				blind1: hasMixGames ? undefined : parseOptionalInt(value.blind1),
				blind2: hasMixGames ? undefined : parseOptionalInt(value.blind2),
				blind3:
					hasMixGames || !hasThirdSlot
						? undefined
						: parseOptionalInt(value.blind3),
				ante:
					hasMixGames || isAnteDisabled
						? undefined
						: parseOptionalInt(value.ante),
				anteType: hasMixGames ? undefined : value.anteType,
				minBuyIn: parseOptionalInt(value.minBuyIn),
				maxBuyIn: parseOptionalInt(value.maxBuyIn),
				tableSize: parseOptionalInt(value.tableSize),
				currencyId: value.currencyId || undefined,
				memo: value.memo ? value.memo : undefined,
			});
		},
		validators: {
			onSubmit: ringGameFormSchema,
		},
	});

	// Picking a mix master reseeds the editor from its saved composition
	// (overwriting whatever was there — switching mixes starts fresh); the
	// legacy "mix" mode key has no composition, so existing rows are kept.
	// Entering a mix clears the flat blind/ante fields so a later
	// switch-back starts clean (c04); leaving mixes clears the editor rows
	// so they stay the single submit-time authority (c02); and a variant
	// whose group has no third slot drops the stale blind3 (c03).
	const onVariantChange = (next: string) => {
		form.setFieldValue("variant", next);
		if (isMixValue(next)) {
			if (next !== "mix") {
				form.setFieldValue(
					"mixGames",
					rowsFromVariantLabels(mixCompositionLabels(next), groupFor)
				);
			}
			form.setFieldValue("blind1", "");
			form.setFieldValue("blind2", "");
			form.setFieldValue("blind3", "");
			form.setFieldValue("ante", "");
			form.setFieldValue("anteType", "none");
			return;
		}
		form.setFieldValue("mixGames", []);
		if (labelsFor(next).blind3 === null) {
			form.setFieldValue("blind3", "");
		}
	};

	const {
		editingMix,
		isMixSheetOpen,
		mixRowFor,
		onEditMix,
		onMixSaved,
		setIsMixSheetOpen,
	} = useMixMasterEditing({
		getRows: () => form.state.values.mixGames,
		groupFor,
		mixes,
		onVariantLabelChange: (label) => form.setFieldValue("variant", label),
		setRows: (rows) => form.setFieldValue("mixGames", rows),
		variants,
	});

	return {
		form,
		currencies,
		editingMix,
		groupFor,
		labelsFor,
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
