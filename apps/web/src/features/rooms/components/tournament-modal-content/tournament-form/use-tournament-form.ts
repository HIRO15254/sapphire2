import {
	DEFAULT_VARIANT_LABEL,
	MIX_VARIANT,
} from "@sapphire2/db/constants/game-variants";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import z from "zod";
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
	variant: string;
}

// フォームの内部値（すべて文字列）を AI merge のベースとなる部分値へ変換する。
function formValuesToPartial(
	value: TournamentFormStateValues
): TournamentPartialFormValues {
	return {
		name: value.name,
		variant: value.variant || DEFAULT_VARIANT_LABEL,
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
	variant: z.string(),
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
	/** Live variant changes (Structure tab keeps its blind labels in sync). */
	onVariantChange?: (variant: string) => void;
}

type VariantScope = "all" | "perLevel";

// The per-level mode is stored as the frozen legacy mix key: such a
// tournament has no single variant — each level's games say what's played.
function scopeOf(variant: string): VariantScope {
	return variant.trim().toLowerCase() === MIX_VARIANT ? "perLevel" : "all";
}

export function useTournamentForm({
	defaultValues,
	onInvalidSubmit,
	onRegisterLiveValues,
	onSubmit,
	onVariantChange,
}: UseTournamentFormOptions) {
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];
	// Last all-levels variant, restored when switching back from per-level.
	const initialVariant = defaultValues?.variant ?? DEFAULT_VARIANT_LABEL;
	const lastAllVariant = useRef(
		scopeOf(initialVariant) === "all" ? initialVariant : DEFAULT_VARIANT_LABEL
	);

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			variant: defaultValues?.variant ?? DEFAULT_VARIANT_LABEL,
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
				variant: value.variant || DEFAULT_VARIANT_LABEL,
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
		onRegisterLiveValues?.(() => formValuesToPartial(form.state.values));
	}, [onRegisterLiveValues, form]);

	const onVariantFieldChange = (variant: string) => {
		form.setFieldValue("variant", variant);
		onVariantChange?.(variant);
	};

	const onScopeChange = (scope: VariantScope, currentVariant: string) => {
		if (scope === scopeOf(currentVariant)) {
			return;
		}
		if (scope === "perLevel") {
			lastAllVariant.current = currentVariant;
			onVariantFieldChange(MIX_VARIANT);
			return;
		}
		onVariantFieldChange(lastAllVariant.current || DEFAULT_VARIANT_LABEL);
	};

	return {
		form,
		currencies,
		onScopeChange,
		onVariantFieldChange,
		scopeOf,
	};
}
