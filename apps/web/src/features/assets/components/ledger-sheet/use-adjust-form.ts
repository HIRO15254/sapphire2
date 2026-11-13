import { useForm } from "@tanstack/react-form";
import type { ChangeEvent, FormEvent } from "react";
import z from "zod";
import type {
	WalletAsset,
	WalletCategory,
} from "@/features/assets/hooks/use-wallet-data";
import { parseQuantity, quantityToInput } from "@/features/assets/utils/amount";
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
import type { AdjustSubmit, WalletLine } from "./ledger-target";

type Direction = "add" | "remove";

function buildSchema(assets: readonly WalletAsset[]) {
	return z
		.object({
			amount: z.string(),
			assetId: z.string().min(1, "Choose an asset"),
			categoryId: z.string(),
			direction: z.enum(["add", "remove"]),
			memo: z.string().max(5000, "Up to 5,000 characters"),
			occurredAt: z.string().min(1, "Enter a date and time"),
		})
		.superRefine((value, ctx) => {
			const asset = assets.find((candidate) => candidate.id === value.assetId);
			const parsed = parseQuantity(value.amount, asset?.decimals ?? 0);
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
}

interface UseAdjustFormOptions {
	assetId: string | null;
	assets: WalletAsset[];
	categories: WalletCategory[];
	line: WalletLine | null;
	lockAsset: boolean;
	onSubmit: (values: AdjustSubmit) => Promise<void>;
}

export function useAdjustForm({
	assetId,
	assets,
	categories,
	line,
	lockAsset,
	onSubmit,
}: UseAdjustFormOptions) {
	const initialAssetId =
		line?.assetId ??
		assetId ??
		assets.find((asset) => asset.archivedAt === null)?.id ??
		"";
	const initialAsset = assets.find((asset) => asset.id === initialAssetId);
	const form = useForm({
		defaultValues: {
			amount: line
				? quantityToInput(line.quantity, initialAsset?.decimals ?? 0)
				: "",
			assetId: initialAssetId,
			categoryId: line?.categoryId ?? NO_CATEGORY,
			direction: (line && line.quantity < 0 ? "remove" : "add") as Direction,
			memo: line?.memo ?? "",
			occurredAt: localDateTimeValue(
				line ? new Date(line.occurredAt) : new Date()
			),
		},
		onSubmit: async ({ value }) => {
			const asset = assets.find((candidate) => candidate.id === value.assetId);
			const parsed = parseQuantity(value.amount, asset?.decimals ?? 0);
			const occurredAt = dateTimeValueToInstant(value.occurredAt);
			if (!(parsed.ok && occurredAt !== null)) {
				return;
			}
			try {
				await onSubmit({
					assetId: value.assetId,
					categoryId: categoryValue(value.categoryId),
					memo: value.memo.trim(),
					occurredAt,
					quantity: value.direction === "remove" ? -parsed.value : parsed.value,
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

	const onDirectionChange =
		(handleChange: (value: Direction) => void) => (value: string) => {
			if (value === "add" || value === "remove") {
				handleChange(value);
			}
		};

	return {
		assetOptions: (current: string) => assetOptions(assets, current),
		categoryOptions: (current: string) => categoryOptions(categories, current),
		form,
		isAssetLocked: lockAsset || line !== null,
		onDirectionChange,
		onFormSubmit,
		onTextChange,
	};
}
