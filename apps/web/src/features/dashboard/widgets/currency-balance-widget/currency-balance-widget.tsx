import { IconCoin } from "@tabler/icons-react";
import { useState } from "react";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/features/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/format-number";
import { profitLossColorClass } from "@/utils/format-profit-loss";
import {
	useCurrencyBalanceOptions,
	useCurrencyBalanceWidget,
} from "./use-currency-balance-widget";

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
	const currencyIdFromConfig =
		typeof config.currencyId === "string" ? config.currencyId : null;
	const [currencyId, setCurrencyId] = useState<string | null>(
		currencyIdFromConfig
	);
	const [isSaving, setIsSaving] = useState(false);
	const currencies = useCurrencyBalanceOptions();

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await onSave({ currencyId });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label htmlFor="currency-balance-id">Currency</Label>
				<select
					className="rounded-md border bg-background px-3 py-2 text-sm"
					id="currency-balance-id"
					onChange={(e) => setCurrencyId(e.target.value || null)}
					value={currencyId ?? ""}
				>
					<option value="">(First available)</option>
					{currencies.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</select>
			</div>
			<DialogActionRow>
				<Button onClick={onCancel} variant="outline">
					Cancel
				</Button>
				<Button disabled={isSaving} onClick={handleSave}>
					{isSaving ? "Saving..." : "Save"}
				</Button>
			</DialogActionRow>
		</div>
	);
}
