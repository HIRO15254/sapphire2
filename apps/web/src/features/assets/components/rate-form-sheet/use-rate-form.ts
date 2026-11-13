import { useForm } from "@tanstack/react-form";
import { type ChangeEvent, type FormEvent, useState } from "react";
import z from "zod";
import type {
	WalletAsset,
	WalletRate,
} from "@/features/assets/hooks/use-wallet-data";
import { unitOrName } from "@/features/assets/utils/asset-display";
import {
	activeCurrencies,
	hasPair,
} from "@/features/assets/utils/asset-options";
import {
	dateValueToInstant,
	localDateValue,
	longDateLabel,
} from "@/features/assets/utils/dates";
import { isConflict } from "@/features/assets/utils/form";
import { parseRate } from "@/features/assets/utils/rate";

export type Effective = "start" | "date";

export interface RateFormSubmit {
	effectiveFrom: number;
	memo: string;
	quoteAssetId: string;
	rateDen: number;
	rateNum: number;
}

interface RateFormState {
	values: { date: string; effective: Effective; quoteAssetId: string };
}

export function selectQuoteAssetId(state: RateFormState) {
	return state.values.quoteAssetId;
}

export function selectWarningInputs(state: RateFormState) {
	return {
		date: state.values.date,
		effective: state.values.effective,
		quoteAssetId: state.values.quoteAssetId,
	};
}

interface UseRateFormOptions {
	assets: WalletAsset[];
	baseAssetId: string;
	baseCurrencyId: string | null;
	defaultEffective: Effective;
	lockedQuoteId: string | null;
	onSubmit: (values: RateFormSubmit) => Promise<void>;
	rates: WalletRate[];
}

function decimalsOf(assets: readonly WalletAsset[], id: string) {
	return assets.find((asset) => asset.id === id)?.decimals ?? 0;
}

export function useRateForm({
	assets,
	baseAssetId,
	baseCurrencyId,
	defaultEffective,
	lockedQuoteId,
	onSubmit,
	rates,
}: UseRateFormOptions) {
	const [conflict, setConflict] = useState<{
		field: "date" | "effective";
		message: string;
	} | null>(null);
	const base = assets.find((asset) => asset.id === baseAssetId);
	const options = lockedQuoteId
		? assets.filter((asset) => asset.id === lockedQuoteId)
		: activeCurrencies(assets, baseCurrencyId).filter(
				(asset) =>
					asset.id !== baseAssetId && !hasPair(rates, baseAssetId, asset.id)
			);
	const today = localDateValue(new Date());
	const schema = z
		.object({
			date: z.string(),
			effective: z.enum(["start", "date"]),
			memo: z.string().max(5000, "Up to 5,000 characters"),
			quoteAssetId: z.string().min(1, "Choose a currency"),
			value: z.string(),
		})
		.superRefine((value, ctx) => {
			const parsed = parseRate(
				value.value,
				base?.decimals ?? 0,
				decimalsOf(assets, value.quoteAssetId)
			);
			if (!parsed.ok) {
				ctx.addIssue({
					code: "custom",
					message: parsed.error,
					path: ["value"],
				});
			}
			if (
				value.effective === "date" &&
				dateValueToInstant(value.date) === null
			) {
				ctx.addIssue({
					code: "custom",
					message: "Enter a date",
					path: ["date"],
				});
			}
		});
	const form = useForm({
		defaultValues: {
			date: today,
			effective: defaultEffective as Effective,
			memo: "",
			quoteAssetId: lockedQuoteId ?? options[0]?.id ?? "",
			value: "",
		},
		onSubmit: async ({ value }) => {
			const parsed = parseRate(
				value.value,
				base?.decimals ?? 0,
				decimalsOf(assets, value.quoteAssetId)
			);
			const effectiveFrom =
				value.effective === "start" ? 0 : dateValueToInstant(value.date);
			if (!parsed.ok || effectiveFrom === null) {
				return;
			}
			try {
				await onSubmit({
					effectiveFrom,
					memo: value.memo.trim(),
					quoteAssetId: value.quoteAssetId,
					...parsed.value,
				});
			} catch (error) {
				if (isConflict(error)) {
					setConflict(
						value.effective === "start"
							? {
									field: "effective",
									message: "This pair already has a rate from the start",
								}
							: {
									field: "date",
									message: "This pair already has a rate starting on this date",
								}
					);
				}
			}
		},
		validators: { onSubmit: schema },
	});

	const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		form.handleSubmit();
	};

	const onTextChange =
		(handleChange: (value: string) => void) =>
		(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			setConflict(null);
			handleChange(event.target.value);
		};

	const onEffectiveChange =
		(handleChange: (value: Effective) => void) => (value: string) => {
			if (value === "start" || value === "date") {
				setConflict(null);
				handleChange(value);
			}
		};

	const warningFor = (
		quoteAssetId: string,
		effective: Effective,
		date: string
	): string | null => {
		const exists = rates.some(
			(rate) =>
				rate.baseAssetId === baseAssetId && rate.quoteAssetId === quoteAssetId
		);
		if (!exists) {
			return null;
		}
		if (effective === "start") {
			return "Every record of this pair before its next rate is valued again with this rate.";
		}
		if (date && date < today) {
			return `Records from ${longDateLabel(new Date(`${date}T00:00`))} until the next rate are valued again with this rate.`;
		}
		return null;
	};

	const quoteHint = (quoteAssetId: string) => {
		const quote = assets.find((asset) => asset.id === quoteAssetId);
		return quote ? unitOrName(quote) : "";
	};

	return {
		conflict,
		form,
		isLocked: lockedQuoteId !== null,
		onEffectiveChange,
		onFormSubmit,
		onTextChange,
		options: options.map((asset) => ({ label: asset.name, value: asset.id })),
		quoteHint,
		valueLabel: `1 ${unitOrName(base)} equals`,
		warningFor,
	};
}
