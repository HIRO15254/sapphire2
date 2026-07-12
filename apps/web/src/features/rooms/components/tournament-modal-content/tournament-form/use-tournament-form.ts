import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import z from "zod";
import type { TournamentPartialFormValues } from "@/features/rooms/components/tournament-modal-content";
import type { TournamentFormValues } from "@/features/rooms/hooks/use-tournaments";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
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
		variant: value.variant || "nlh",
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
}

export function useTournamentForm({
	defaultValues,
	onInvalidSubmit,
	onRegisterLiveValues,
	onSubmit,
}: UseTournamentFormOptions) {
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];
	// Level games live on the Structure tab; the Details tab only needs to
	// know whether the picked variant is a mix (to point the user there).
	const { isMixValue } = useGameGroups();

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			variant: defaultValues?.variant ?? "nlh",
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
				variant: value.variant || "nlh",
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

	return { form, currencies, isMixValue };
}
