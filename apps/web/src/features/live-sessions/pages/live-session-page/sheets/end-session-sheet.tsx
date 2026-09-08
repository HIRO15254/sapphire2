import type { ReactNode } from "react";
import { CashGameCompleteForm } from "@/features/live-sessions/components/cash-game-complete-form";
import { computeCashGamePL } from "@/features/live-sessions/utils/live-session-summary";
import { cn } from "@/lib/utils";
import { formatNumber, formatSignedNumber } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";
import { plToneClass } from "../cryst-tone";
import { CrystFormSheet } from "./cryst-form-sheet";

const FORM_ID = "cryst-end-session-form";

interface EndSessionSheetProps {
	chipRemoveTotal: number;
	defaultFinalStack?: number;
	evDiff: number;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: { finalStack: number }) => void;
	open: boolean;
	totalBuyIn: number;
}

function SummaryRow({
	formula,
	label,
	tone,
	value,
}: {
	formula?: string;
	label: string;
	tone?: string;
	value: string;
}) {
	return (
		<div className="flex justify-between gap-3">
			<dt className="text-muted-foreground">
				<span>{label}</span>
				{formula ? <span> ({formula})</span> : null}
			</dt>
			<dd className={cn("font-mono tabular-nums", tone)}>{value}</dd>
		</div>
	);
}

export function EndSessionSheet({
	chipRemoveTotal,
	defaultFinalStack,
	evDiff,
	isPending,
	onOpenChange,
	onSubmit,
	open,
	totalBuyIn,
}: EndSessionSheetProps) {
	const renderSummary = (finalStack: number | undefined): ReactNode => {
		const { displayPL, evPL } = computeCashGamePL({
			chipRemoveTotal,
			currentStack: finalStack ?? null,
			evDiff,
			totalBuyIn,
		});
		const cashOut = finalStack === undefined ? "—" : formatNumber(finalStack);

		return (
			<dl className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2.5 text-[length:var(--text-xs)]">
				<SummaryRow label="Total buy-in" value={formatNumber(totalBuyIn)} />
				<SummaryRow
					label="Total withdrawn"
					value={formatNumber(chipRemoveTotal)}
				/>
				<SummaryRow
					formula={
						displayPL === null
							? undefined
							: `${cashOut} + ${formatNumber(chipRemoveTotal)} − ${formatNumber(totalBuyIn)}`
					}
					label="Result"
					tone={plToneClass(displayPL)}
					value={displayPL === null ? "—" : formatProfitLoss(displayPL)}
				/>
				<SummaryRow
					formula={
						evPL === null
							? undefined
							: `result + EV delta ${formatSignedNumber(evDiff)}`
					}
					label="EV result"
					value={evPL === null ? "—" : formatProfitLoss(evPL)}
				/>
			</dl>
		);
	};

	return (
		<CrystFormSheet
			className="h-auto max-h-[calc(100svh-2rem)]"
			formId={FORM_ID}
			isLoading={isPending}
			onOpenChange={onOpenChange}
			open={open}
			title="End session"
		>
			<div className="flex flex-col gap-3">
				<CashGameCompleteForm
					defaultFinalStack={defaultFinalStack}
					formId={FORM_ID}
					label="Cash-out amount"
					onSubmit={onSubmit}
					renderSummary={renderSummary}
				/>
			</div>
		</CrystFormSheet>
	);
}
