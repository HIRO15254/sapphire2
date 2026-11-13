import { useForm } from "@tanstack/react-form";
import type { ChangeEvent, FormEvent } from "react";
import z from "zod";
import type {
	WalletAsset,
	WalletCategory,
} from "@/features/assets/hooks/use-wallet-data";
import { parseQuantity } from "@/features/assets/utils/amount";
import {
	dateTimeValueToInstant,
	localDateTimeValue,
} from "@/features/assets/utils/dates";
import {
	assetOptions,
	categoryOptions,
	categoryValue,
	NO_CATEGORY,
} from "./ledger-options";
import type { ExchangeSubmit } from "./ledger-target";

function decimalsOf(assets: readonly WalletAsset[], id: string) {
	return assets.find((asset) => asset.id === id)?.decimals ?? 0;
}

function buildSchema(assets: readonly WalletAsset[]) {
	return z
		.object({
			categoryId: z.string(),
			fromAmount: z.string(),
			fromId: z.string().min(1, "Choose an asset"),
			memo: z.string().max(5000, "Up to 5,000 characters"),
			occurredAt: z.string().min(1, "Enter a date and time"),
			toAmount: z.string(),
			toId: z.string().min(1, "Choose an asset"),
		})
		.superRefine((value, ctx) => {
			for (const [amount, id, path] of [
				[value.fromAmount, value.fromId, "fromAmount"],
				[value.toAmount, value.toId, "toAmount"],
			] as const) {
				const parsed = parseQuantity(amount, decimalsOf(assets, id));
				if (!parsed.ok) {
					ctx.addIssue({ code: "custom", message: parsed.error, path: [path] });
				}
			}
			if (value.fromId && value.fromId === value.toId) {
				ctx.addIssue({
					code: "custom",
					message: "Choose a different asset",
					path: ["toId"],
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
}

interface UseExchangeFormOptions {
	assets: WalletAsset[];
	categories: WalletCategory[];
	fromId: string | null;
	onSubmit: (values: ExchangeSubmit) => Promise<void>;
}

export function useExchangeForm({
	assets,
	categories,
	fromId,
	onSubmit,
}: UseExchangeFormOptions) {
	const active = assets.filter((asset) => asset.archivedAt === null);
	const initialFrom = fromId ?? active[0]?.id ?? "";
	const initialTo = active.find((asset) => asset.id !== initialFrom)?.id ?? "";
	const form = useForm({
		defaultValues: {
			categoryId: NO_CATEGORY,
			fromAmount: "",
			fromId: initialFrom,
			memo: "",
			occurredAt: localDateTimeValue(new Date()),
			toAmount: "",
			toId: initialTo,
		},
		onSubmit: async ({ value }) => {
			const from = parseQuantity(
				value.fromAmount,
				decimalsOf(assets, value.fromId)
			);
			const to = parseQuantity(value.toAmount, decimalsOf(assets, value.toId));
			const occurredAt = dateTimeValueToInstant(value.occurredAt);
			if (!(from.ok && to.ok && occurredAt !== null)) {
				return;
			}
			try {
				await onSubmit({
					categoryId: categoryValue(value.categoryId),
					from: { assetId: value.fromId, quantity: from.value },
					memo: value.memo.trim(),
					occurredAt,
					to: { assetId: value.toId, quantity: to.value },
				});
				// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation reports its own failure and the sheet keeps the input.
			} catch {}
		},
		validators: { onSubmit: buildSchema(assets) },
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

	return {
		assetOptions: assetOptions(active, ""),
		categoryOptions: (current: string) => categoryOptions(categories, current),
		form,
		onFormSubmit,
		onTextChange,
	};
}
