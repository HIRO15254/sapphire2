import { useForm } from "@tanstack/react-form";
import { type ChangeEvent, type FormEvent, useState } from "react";
import z from "zod";
import type { WalletAsset } from "@/features/assets/hooks/use-wallet-data";
import { isNameConflict } from "@/features/assets/utils/form";
import { parseRate } from "@/features/assets/utils/rate";

export const DECIMAL_OPTIONS = ["0", "1", "2", "3", "4"] as const;

export interface AssetFormSubmit {
	decimals: number;
	description: string;
	initialRates: { quoteAssetId: string; rateDen: number; rateNum: number }[];
	kind: "currency" | "item";
	name: string;
	unit: string;
}

interface RateRow {
	key: string;
	quoteAssetId: string;
	value: string;
}

function buildSchema(currencies: readonly WalletAsset[]) {
	return z
		.object({
			decimals: z.enum(DECIMAL_OPTIONS),
			description: z.string().max(50_000, "Up to 50,000 characters"),
			kind: z.enum(["currency", "item"]),
			name: z
				.string()
				.trim()
				.min(1, "Enter a name")
				.max(100, "Up to 100 characters"),
			rates: z.array(
				z.object({
					key: z.string(),
					quoteAssetId: z.string(),
					value: z.string(),
				})
			),
			unit: z.string().max(20, "Up to 20 characters"),
		})
		.superRefine((value, ctx) => {
			value.rates.forEach((row, index) => {
				const quote = currencies.find((asset) => asset.id === row.quoteAssetId);
				if (!quote) {
					ctx.addIssue({
						code: "custom",
						message: "Choose a currency",
						path: ["rates", index, "value"],
					});
					return;
				}
				const parsed = parseRate(
					row.value,
					Number(value.decimals),
					quote.decimals
				);
				if (!parsed.ok) {
					ctx.addIssue({
						code: "custom",
						message: parsed.error,
						path: ["rates", index, "value"],
					});
				}
			});
		});
}

export function selectRateLabelParts(state: {
	values: { name: string; unit: string };
}) {
	return { name: state.values.name.trim(), unit: state.values.unit.trim() };
}

interface UseAssetFormOptions {
	asset: WalletAsset | null;
	currencies: WalletAsset[];
	onSubmit: (values: AssetFormSubmit) => Promise<void>;
}

export function useAssetForm({
	asset,
	currencies,
	onSubmit,
}: UseAssetFormOptions) {
	const [nameError, setNameError] = useState<string | null>(null);
	const isLocked = asset?.isReferenced ?? false;
	const form = useForm({
		defaultValues: {
			decimals: String(
				asset?.decimals ?? 0
			) as (typeof DECIMAL_OPTIONS)[number],
			description: asset?.description ?? "",
			kind: asset?.kind ?? ("currency" as "currency" | "item"),
			name: asset?.name ?? "",
			rates: [] as RateRow[],
			unit: asset?.unit ?? "",
		},
		onSubmit: async ({ value }) => {
			const decimals = Number(value.decimals);
			const initialRates = value.rates.flatMap((row) => {
				const quote = currencies.find(
					(currency) => currency.id === row.quoteAssetId
				);
				const parsed = parseRate(row.value, decimals, quote?.decimals ?? 0);
				return parsed.ok
					? [{ quoteAssetId: row.quoteAssetId, ...parsed.value }]
					: [];
			});
			try {
				await onSubmit({
					decimals,
					description: value.description.trim(),
					initialRates,
					kind: value.kind,
					name: value.name.trim(),
					unit: value.unit.trim(),
				});
			} catch (error) {
				if (isNameConflict(error)) {
					setNameError("An asset with this name already exists");
				}
			}
		},
		validators: { onSubmit: buildSchema(currencies) },
	});

	const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		form.handleSubmit();
	};

	const onTextChange =
		(handleChange: (value: string) => void, field?: "name") =>
		(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			if (field === "name") {
				setNameError(null);
			}
			handleChange(event.target.value);
		};

	const onKindChange =
		(handleChange: (value: "currency" | "item") => void) => (value: string) => {
			if (value === "currency" || value === "item") {
				handleChange(value);
			}
		};

	const onDecimalsChange =
		(handleChange: (value: (typeof DECIMAL_OPTIONS)[number]) => void) =>
		(value: string) => {
			const option = DECIMAL_OPTIONS.find((candidate) => candidate === value);
			if (option) {
				handleChange(option);
			}
		};

	const onAddRate = (rows: RateRow[]) => () => {
		const used = new Set(rows.map((row) => row.quoteAssetId));
		const next = currencies.find((currency) => !used.has(currency.id));
		if (!next) {
			return;
		}
		form.pushFieldValue("rates", {
			key: crypto.randomUUID(),
			quoteAssetId: next.id,
			value: "",
		});
	};

	const onRemoveRate = (index: number) => () => {
		form.removeFieldValue("rates", index);
	};

	const quoteOptions = (rows: RateRow[], current: string) =>
		currencies.filter(
			(currency) =>
				currency.id === current ||
				!rows.some((row) => row.quoteAssetId === currency.id)
		);

	return {
		form,
		isLocked,
		isNew: asset === null,
		nameError,
		onAddRate,
		onDecimalsChange,
		onFormSubmit,
		onKindChange,
		onRemoveRate,
		onTextChange,
		quoteOptions,
		showRates: asset === null && currencies.length > 0,
		totalCurrencies: currencies.length,
	};
}
