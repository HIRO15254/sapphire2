import type { ReactNode } from "react";
import { CashGameCompleteForm } from "@/features/live-sessions/components/cash-game-complete-form";
import { computeCashGamePL } from "@/features/live-sessions/utils/live-session-summary";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/format-number";
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
		<div className="flex items-baseline justify-between gap-3">
			<dt className="flex items-baseline gap-1 text-muted-foreground">
				<span>{label}</span>
				{formula ? (
					<span className="font-mono text-[10px]">{formula}</span>
				) : null}
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
					formula={`${cashOut} + ${formatNumber(chipRemoveTotal)} − ${formatNumber(totalBuyIn)}`}
					label="Result"
					tone={plToneClass(displayPL)}
					value={displayPL === null ? "—" : formatProfitLoss(displayPL)}
				/>
				<SummaryRow
					formula={`Result ${evDiff < 0 ? "−" : "+"} ${formatNumber(Math.abs(evDiff))}`}
					label="EV result"
					tone={plToneClass(evPL)}
					value={evPL === null ? "—" : formatProfitLoss(evPL)}
				/>
			</dl>
		);
	};

	return (
		<CrystFormSheet
			formId={FORM_ID}
			isLoading={isPending}
			onOpenChange={onOpenChange}
			open={open}
			title="End session"
		>
			<div className="flex flex-col gap-4">
				<CashGameCompleteForm
					defaultFinalStack={defaultFinalStack}
					formId={FORM_ID}
					onSubmit={onSubmit}
					renderSummary={renderSummary}
				/>
				<p className="text-[11px] text-muted-foreground">
					You can edit this from history later. This closes the record.
				</p>
			</div>
		</CrystFormSheet>
	);
}
