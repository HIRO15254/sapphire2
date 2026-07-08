import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import z from "zod";
import { useGameVariants } from "@/features/game-variants/hooks/use-game-variants";
import { resolveBlindLabels } from "@/features/game-variants/utils/blind-labels";
import type { RingGameFormValues } from "@/features/rooms/hooks/use-ring-games";
import { optionalNumericString } from "@/shared/lib/form-fields";
import { trpc } from "@/utils/trpc";

type RingGameAnteType = "all" | "bb" | "none";

const ringGameFormSchema = z.object({
	name: z.string().min(1, "Game name is required"),
	variantId: z.string().min(1, "Variant is required"),
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

interface VariantOption {
	id: string;
	name: string;
}

/**
 * Resolve which variant should be preselected in the form. Create mode has no
 * `defaultValues` and falls back to the user's first (lowest sortOrder)
 * variant. Edit mode matches the game's existing free-text `variant` against
 * the user's variant names (case-insensitive, since the text predates
 * user-defined variants and casing can drift) and falls back to the game's
 * stored `variantId` (e.g. the matching variant was since renamed) or "".
 */
function resolveDefaultVariantId(
	defaultValues: RingGameFormValues | undefined,
	variants: readonly VariantOption[]
): string {
	if (!defaultValues) {
		return variants[0]?.id ?? "";
	}
	const normalized = (defaultValues.variant ?? "").toLowerCase();
	const matched = variants.find((v) => v.name.toLowerCase() === normalized);
	return matched?.id ?? defaultValues.variantId ?? "";
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

	const { variants } = useGameVariants();

	const defaultVariantId = resolveDefaultVariantId(defaultValues, variants);

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			variantId: defaultVariantId,
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
			const selectedVariant = variants.find((v) => v.id === value.variantId);
			onSubmit({
				name: value.name,
				variant: selectedVariant?.name ?? defaultValues?.variant ?? "NLH",
				variantId: value.variantId || undefined,
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

	const selectedVariantName =
		variants.find((v) => v.id === defaultVariantId)?.name ??
		defaultValues?.variant;
	const blindLabels = resolveBlindLabels(selectedVariantName, variants);

	return { form, currencies, variants, blindLabels };
}
