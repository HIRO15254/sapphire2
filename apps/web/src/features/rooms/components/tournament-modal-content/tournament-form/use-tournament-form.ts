import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import z from "zod";
import { useGameVariants } from "@/features/game-variants/hooks/use-game-variants";
import { resolveBlindLabels } from "@/features/game-variants/utils/blind-labels";
import type { TournamentPartialFormValues } from "@/features/rooms/components/tournament-modal-content";
import type { TournamentFormValues } from "@/features/rooms/hooks/use-tournaments";
import { optionalNumericString } from "@/shared/lib/form-fields";
import { trpc } from "@/utils/trpc";

interface ChipPurchaseFormItem {
	chips: string;
	cost: string;
	name: string;
	uid: string;
}

interface TournamentFormStateValues {
	bountyAmount: string;
	buyIn: string;
	chipPurchases: ChipPurchaseFormItem[];
	currencyId: string;
	entryFee: string;
	memo: string;
	name: string;
	startingStack: string;
	tableSize: string;
	tags: string[];
	variantId: string;
}

interface VariantOption {
	id: string;
	name: string;
}

/** Resolves the free-text variant name from the selected variantId, falling
 * back to whatever variant text the caller already had (e.g. defaultValues)
 * and finally to "NLH" when nothing else is available. */
function resolveVariantName(
	variantId: string,
	variants: readonly VariantOption[],
	fallback: string | undefined
): string {
	return variants.find((v) => v.id === variantId)?.name ?? fallback ?? "NLH";
}

/**
 * Resolve which variant should be preselected in the form. Create mode has no
 * `defaultValues` and falls back to the user's first (lowest sortOrder)
 * variant. Edit mode matches the tournament's existing free-text `variant`
 * against the user's variant names (case-insensitive) and falls back to the
 * tournament's stored `variantId`, then "".
 */
function resolveDefaultVariantId(
	defaultValues: { variant?: string; variantId?: string } | undefined,
	variants: readonly VariantOption[]
): string {
	if (!defaultValues) {
		return variants[0]?.id ?? "";
	}
	const normalized = (defaultValues.variant ?? "").toLowerCase();
	const matched = variants.find((v) => v.name.toLowerCase() === normalized);
	return matched?.id ?? defaultValues.variantId ?? "";
}

// フォームの内部値（すべて文字列）を AI merge のベースとなる部分値へ変換する。
function formValuesToPartial(
	value: TournamentFormStateValues,
	variants: readonly VariantOption[],
	fallbackVariant: string | undefined
): TournamentPartialFormValues {
	return {
		name: value.name,
		variant: resolveVariantName(value.variantId, variants, fallbackVariant),
		variantId: value.variantId || undefined,
		buyIn: parseOptInt(value.buyIn),
		entryFee: parseOptInt(value.entryFee),
		startingStack: parseOptInt(value.startingStack),
		bountyAmount: parseOptInt(value.bountyAmount),
		tableSize: parseOptInt(value.tableSize),
		currencyId: value.currencyId || undefined,
		memo: value.memo || undefined,
		tags: value.tags,
		chipPurchases: value.chipPurchases.map((cp) => ({
			name: cp.name,
			cost: parseCostInt(cp.cost),
			chips: parseCostInt(cp.chips),
		})),
	};
}

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

function parseCostInt(value: string): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

const chipPurchaseItemSchema = z.object({
	name: z.string(),
	cost: z.string(),
	chips: z.string(),
	uid: z.string(),
});

const tournamentFormSchema = z.object({
	name: z.string().min(1, "Tournament name is required"),
	variantId: z.string(),
	buyIn: optionalNumericString({ integer: true, min: 0 }),
	entryFee: optionalNumericString({ integer: true, min: 0 }),
	startingStack: optionalNumericString({ integer: true, min: 0 }),
	bountyAmount: optionalNumericString({ integer: true, min: 0 }),
	tableSize: z.string(),
	currencyId: z.string(),
	memo: z.string(),
	tags: z.array(z.string()),
	chipPurchases: z.array(chipPurchaseItemSchema),
});

interface UseTournamentFormOptions {
	defaultValues?: Omit<TournamentFormValues, "tags" | "chipPurchases"> & {
		chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
		tags?: string[];
	};
	onInvalidSubmit?: () => void;
	onRegisterLiveValues?: (getter: () => TournamentPartialFormValues) => void;
	onSubmit: (values: TournamentFormValues) => void;
}

export function useTournamentForm({
	defaultValues,
	onInvalidSubmit,
	onRegisterLiveValues,
	onSubmit,
}: UseTournamentFormOptions) {
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const { variants } = useGameVariants();

	const defaultVariantId = resolveDefaultVariantId(defaultValues, variants);

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			variantId: defaultVariantId,
			buyIn: numStrOrEmpty(defaultValues?.buyIn),
			entryFee: numStrOrEmpty(defaultValues?.entryFee),
			startingStack: numStrOrEmpty(defaultValues?.startingStack),
			bountyAmount: numStrOrEmpty(defaultValues?.bountyAmount),
			tableSize: defaultValues?.tableSize?.toString() ?? "",
			currencyId: defaultValues?.currencyId ?? "",
			memo: defaultValues?.memo ?? "",
			tags: defaultValues?.tags ?? [],
			chipPurchases: (defaultValues?.chipPurchases ?? []).map((cp) => ({
				name: cp.name,
				cost: String(cp.cost),
				chips: String(cp.chips),
				uid: crypto.randomUUID(),
			})) as ChipPurchaseFormItem[],
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				variant: resolveVariantName(
					value.variantId,
					variants,
					defaultValues?.variant
				),
				variantId: value.variantId || undefined,
				buyIn: parseOptInt(value.buyIn),
				entryFee: parseOptInt(value.entryFee),
				startingStack: parseOptInt(value.startingStack),
				chipPurchases: value.chipPurchases.map((cp) => ({
					name: cp.name,
					cost: parseCostInt(cp.cost),
					chips: parseCostInt(cp.chips),
				})),
				bountyAmount: parseOptInt(value.bountyAmount),
				tableSize: parseOptInt(value.tableSize),
				currencyId: value.currencyId || undefined,
				memo: value.memo ? value.memo : undefined,
				tags: value.tags,
			});
		},
		validators: {
			onSubmit: tournamentFormSchema,
		},
		onSubmitInvalid: () => {
			onInvalidSubmit?.();
		},
	});

	useEffect(() => {
		onRegisterLiveValues?.(() =>
			formValuesToPartial(form.state.values, variants, defaultValues?.variant)
		);
	}, [onRegisterLiveValues, form, variants, defaultValues?.variant]);

	const selectedVariantName =
		variants.find((v) => v.id === defaultVariantId)?.name ??
		defaultValues?.variant;
	const blindLabels = resolveBlindLabels(selectedVariantName, variants);

	return { form, currencies, variants, blindLabels };
}
