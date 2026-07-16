import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import z from "zod";
import type { TournamentPartialFormValues } from "@/features/rooms/components/tournament-modal-content";
import type { TournamentFormValues } from "@/features/rooms/hooks/use-tournaments";
import { useVariantScope } from "@/shared/hooks/use-variant-scope";
import {
	optionalNumericString,
	parseOptionalInt,
	parseRequiredInt,
	requiredNumericString,
} from "@/shared/lib/form-fields";
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
		buyIn: parseOptionalInt(value.buyIn),
		entryFee: parseOptionalInt(value.entryFee),
		startingStack: parseOptionalInt(value.startingStack),
		bountyAmount: parseOptionalInt(value.bountyAmount),
		tableSize: parseOptionalInt(value.tableSize),
		currencyId: value.currencyId || undefined,
		memo: value.memo || undefined,
		tags: value.tags,
		chipPurchases: value.chipPurchases.map((cp) => ({
			name: cp.name,
			cost: parseRequiredInt(cp.cost),
			chips: parseRequiredInt(cp.chips),
		})),
	};
}

function numStrOrEmpty(value: number | undefined): string {
	return value === undefined ? "" : String(value);
}

const chipPurchaseItemSchema = z.object({
	name: z.string().min(1, "Name is required"),
	cost: requiredNumericString({ integer: true, min: 0 }),
	chips: requiredNumericString({ integer: true, min: 0 }),
	uid: z.string(),
});

const tournamentFormSchema = z.object({
	name: z.string().min(1, "Tournament name is required"),
	variant: z.string().trim().min(1, "Variant is required"),
	buyIn: optionalNumericString({ integer: true, min: 0 }),
	entryFee: optionalNumericString({ integer: true, min: 0 }),
	startingStack: optionalNumericString({ integer: true, min: 0 }),
	bountyAmount: optionalNumericString({ integer: true, min: 0 }),
	tableSize: optionalNumericString({ integer: true, min: 2, max: 10 }),
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

export function useTournamentForm({
	defaultValues,
	onInvalidSubmit,
	onRegisterLiveValues,
	onSubmit,
	onVariantChange,
}: UseTournamentFormOptions) {
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

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
				variant: value.variant,
				buyIn: parseOptionalInt(value.buyIn),
				entryFee: parseOptionalInt(value.entryFee),
				startingStack: parseOptionalInt(value.startingStack),
				chipPurchases: value.chipPurchases.map((cp) => ({
					name: cp.name,
					cost: parseRequiredInt(cp.cost),
					chips: parseRequiredInt(cp.chips),
				})),
				bountyAmount: parseOptionalInt(value.bountyAmount),
				tableSize: parseOptionalInt(value.tableSize),
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

	// All-levels vs per-level scope toggle, shared with the session wizard.
	const { onScopeChange, scopeOf } = useVariantScope({
		initialVariant: defaultValues?.variant,
		setVariant: onVariantFieldChange,
	});

	return {
		form,
		currencies,
		onScopeChange,
		onVariantFieldChange,
		scopeOf,
	};
}
