import { IconCoin } from "@tabler/icons-react";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/features/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/format-number";
import { profitLossColorClass } from "@/utils/format-profit-loss";
import { useCurrencyBalanceEditForm } from "./use-currency-balance-edit-form";
import { useCurrencyBalanceWidget } from "./use-currency-balance-widget";

export function CurrencyBalanceWidget({ config }: WidgetRenderProps) {
	const { isLoading, currencies, selected } = useCurrencyBalanceWidget(config);

	if (isLoading) {
		return (
			<div className="flex h-full items-center p-2">
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}

	if (currencies.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
				No currencies
			</div>
		);
	}

	if (!selected) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
				Currency not found
			</div>
		);
	}

	const balance = Number(selected.balance ?? 0);
	return (
		<div className="flex h-full flex-col justify-center gap-1 p-3">
			<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
				<IconCoin size={14} />
				<span className="truncate">{selected.name}</span>
			</div>
			<div
				className={`font-semibold text-xl tabular-nums ${profitLossColorClass(balance)}`}
			>
				{formatCompactNumber(balance)}
				{selected.unit ? (
					<span className="ml-1 font-normal text-muted-foreground text-sm">
						{selected.unit}
					</span>
				) : null}
			</div>
		</div>
	);
}

export function CurrencyBalanceEditForm({
	config,
	onSave,
	onCancel,
}: WidgetEditProps) {
	const { form, currencies, FIRST_AVAILABLE } = useCurrencyBalanceEditForm({
		config,
		onSave,
	});

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="currencyId">
				{(field) => (
					<Field htmlFor={field.name} label="Currency">
						<Select
							onValueChange={(value) => field.handleChange(value)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={FIRST_AVAILABLE}>
									(First available)
								</SelectItem>
								{currencies.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>
			<DialogActionRow>
				<Button onClick={onCancel} type="button" variant="outline">
					Cancel
				</Button>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button disabled={!canSubmit || isSubmitting} type="submit">
							{isSubmitting ? "Saving..." : "Save"}
						</Button>
					)}
				</form.Subscribe>
			</DialogActionRow>
		</form>
	);
}
