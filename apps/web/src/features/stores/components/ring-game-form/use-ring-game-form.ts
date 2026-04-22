import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { RingGameFormValues } from "@/features/stores/hooks/use-ring-games";
import { optionalNumericString } from "@/shared/lib/form-fields";
import { trpc } from "@/utils/trpc";

type RingGameAnteType = "all" | "bb" | "none";

const ringGameFormSchema = z.object({
	name: z.string().min(1, "Game name is required"),
	variant: z.string().min(1),
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

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			variant: (defaultValues?.variant ?? "nlh") as string,
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
				variant: value.variant || "nlh",
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

	return { form, currencies };
}
