import { IconCoin } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/format-number";
import { profitLossColorClass } from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

interface ParsedConfig {
	currencyId: string | null;
}

function parseConfig(raw: Record<string, unknown>): ParsedConfig {
	const currencyId = typeof raw.currencyId === "string" ? raw.currencyId : null;
	return { currencyId };
}

export function CurrencyBalanceWidget({ config }: WidgetRenderProps) {
	const parsed = parseConfig(config);
	const query = useQuery(trpc.currency.list.queryOptions());

	if (query.isLoading) {
		return (
			<div className="flex h-full items-center p-2">
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}

	const currencies = query.data ?? [];
	if (currencies.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
				No currencies
			</div>
		);
	}

	const selected =
		parsed.currencyId === null
			? currencies[0]
			: currencies.find((c) => c.id === parsed.currencyId);

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
	const parsed = parseConfig(config);
	const [currencyId, setCurrencyId] = useState<string | null>(
		parsed.currencyId
	);
	const [isSaving, setIsSaving] = useState(false);
	const query = useQuery(trpc.currency.list.queryOptions());
	const currencies = query.data ?? [];

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
