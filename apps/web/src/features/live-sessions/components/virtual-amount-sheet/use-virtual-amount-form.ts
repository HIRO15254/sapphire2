import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import z from "zod";
import {
	buildItemVirtualPayload,
	buildPureVirtualPayload,
	type VirtualAmountItemOption,
	type VirtualAmountPayload,
} from "@/features/live-sessions/utils/virtual-amount";
import { requiredNumericString } from "@/shared/lib/form-fields";

// Item mode records "N registered items"; amount mode records a free
// currency-equivalent value. Both stay out of the currency ledger.
const virtualAmountSchema = z
	.object({
		mode: z.enum(["item", "amount"]),
		itemId: z.string(),
		count: z.string(),
		amount: z.string(),
	})
	.superRefine((value, ctx) => {
		if (value.mode === "item") {
			if (value.itemId === "") {
				ctx.addIssue({ code: "custom", message: "Required", path: ["itemId"] });
			}
			const countCheck = requiredNumericString({
				integer: true,
				min: 1,
			}).safeParse(value.count);
			if (!countCheck.success) {
				ctx.addIssue({
					code: "custom",
					message: countCheck.error.issues[0]?.message ?? "Invalid",
					path: ["count"],
				});
			}
			return;
		}
		const amountCheck = requiredNumericString({
			integer: true,
			min: 1,
		}).safeParse(value.amount);
		if (!amountCheck.success) {
			ctx.addIssue({
				code: "custom",
				message: amountCheck.error.issues[0]?.message ?? "Invalid",
				path: ["amount"],
			});
		}
	});

interface UseVirtualAmountFormOptions {
	items: VirtualAmountItemOption[];
	onSubmit: (payload: VirtualAmountPayload) => void;
	open: boolean;
}

const DEFAULT_VALUES = {
	mode: "item" as "item" | "amount",
	itemId: "",
	count: "1",
	amount: "",
};

export function useVirtualAmountForm({
	items,
	open,
	onSubmit,
}: UseVirtualAmountFormOptions) {
	const form = useForm({
		defaultValues: DEFAULT_VALUES,
		onSubmit: ({ value }) => {
			if (value.mode === "item") {
				const item = items.find((candidate) => candidate.id === value.itemId);
				if (!item) {
					return;
				}
				onSubmit(
					buildItemVirtualPayload(item, Math.round(Number(value.count)))
				);
				return;
			}
			onSubmit(buildPureVirtualPayload(Math.round(Number(value.amount))));
		},
		validators: {
			onSubmit: virtualAmountSchema,
		},
	});

	useEffect(() => {
		if (open) {
			form.reset(DEFAULT_VALUES);
		}
	}, [open, form]);

	return { form, hasItems: items.length > 0 };
}
