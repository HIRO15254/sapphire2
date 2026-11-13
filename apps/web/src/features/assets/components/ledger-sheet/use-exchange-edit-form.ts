import { useForm } from "@tanstack/react-form";
import type { ChangeEvent, FormEvent } from "react";
import z from "zod";
import type {
	WalletAsset,
	WalletCategory,
} from "@/features/assets/hooks/use-wallet-data";
import {
	formatSignedQuantity,
	parseQuantity,
	quantityToInput,
} from "@/features/assets/utils/amount";
import {
	dateTimeValueToInstant,
	localDateTimeValue,
} from "@/features/assets/utils/dates";
import { categoryOptions, categoryValue, NO_CATEGORY } from "./ledger-options";
import type {
	ExchangeEditSubmit,
	WalletHistoryItem,
	WalletLine,
} from "./ledger-target";

interface UseExchangeEditFormOptions {
	assets: WalletAsset[];
	categories: WalletCategory[];
	counterpart: WalletHistoryItem["counterpart"];
	line: WalletLine;
	onSubmit: (values: ExchangeEditSubmit) => Promise<void>;
}

export function useExchangeEditForm({
	assets,
	categories,
	counterpart,
	line,
	onSubmit,
}: UseExchangeEditFormOptions) {
	const asset = assets.find((candidate) => candidate.id === line.assetId);
	const otherAsset = counterpart
		? assets.find((candidate) => candidate.id === counterpart.assetId)
		: undefined;
	const decimals = asset?.decimals ?? 0;
	const schema = z
		.object({
			amount: z.string(),
			categoryId: z.string(),
			memo: z.string().max(5000, "Up to 5,000 characters"),
			occurredAt: z.string().min(1, "Enter a date and time"),
		})
		.superRefine((value, ctx) => {
			const parsed = parseQuantity(value.amount, decimals);
			if (!parsed.ok) {
				ctx.addIssue({
					code: "custom",
					message: parsed.error,
					path: ["amount"],
				});
			}
			if (
				value.occurredAt &&
				dateTimeValueToInstant(value.occurredAt) === null
			) {
				ctx.addIssue({
					code: "custom",
					message: "Enter a date and time",
					path: ["occurredAt"],
				});
			}
		});
	const form = useForm({
		defaultValues: {
			amount: quantityToInput(line.quantity, decimals),
			categoryId: line.categoryId ?? NO_CATEGORY,
			memo: line.memo ?? "",
			occurredAt: localDateTimeValue(new Date(line.occurredAt)),
		},
		onSubmit: async ({ value }) => {
			const parsed = parseQuantity(value.amount, decimals);
			const occurredAt = dateTimeValueToInstant(value.occurredAt);
			if (!(parsed.ok && occurredAt !== null)) {
				return;
			}
			try {
				await onSubmit({
					categoryId: categoryValue(value.categoryId),
					memo: value.memo.trim(),
					occurredAt,
					quantity: line.quantity < 0 ? -parsed.value : parsed.value,
				});
				// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation reports its own failure and the sheet keeps the input.
			} catch {}
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
		(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			handleChange(event.target.value);

	const assetName = asset?.name ?? "";
	return {
		amountLabel: `${line.quantity < 0 ? "Amount out of" : "Amount into"} ${assetName}`,
		categoryOptions: (current: string) => categoryOptions(categories, current),
		form,
		onFormSubmit,
		onTextChange,
		otherText:
			counterpart && otherAsset
				? `${formatSignedQuantity(counterpart.quantity, otherAsset)} ${otherAsset.name}`
				: "",
	};
}
