import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import z from "zod";
import { optionalNumericString } from "@/shared/lib/form-fields";
import type { TournamentFormValues } from "@/stores/hooks/use-tournaments";
import { trpc } from "@/utils/trpc";

interface ChipPurchaseFormItem {
	chips: string;
	cost: string;
	name: string;
	uid: string;
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
	onSubmit: (values: TournamentFormValues) => void;
}

export function useTournamentForm({
	defaultValues,
	onSubmit,
}: UseTournamentFormOptions) {
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

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
	});

	return { form, currencies };
}
