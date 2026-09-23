import { useCashGameCompleteForm } from "@/features/live-sessions/components/cash-game-complete-form";
import { computeCashGamePL } from "@/features/live-sessions/utils/live-session-summary";
import { cn } from "@/lib/utils";
import { parseOptionalInt } from "@/shared/lib/form-fields";
import { formatNumber, formatSignedNumber } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";
import { plToneClass } from "../cryst-tone";
import { CrystFormSheet } from "./cryst-form-sheet";
import {
	END_SHEET_FOOTER,
	EndNumericField,
	EndSheetNote,
} from "./end-sheet-fields";

const FORM_ID = "cryst-end-session-form";
const CASH_OUT_ID = "cryst-end-cash-out";

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

function CashOutSummary({
	chipRemoveTotal,
	evDiff,
	finalStack,
	totalBuyIn,
}: {
	chipRemoveTotal: number;
	evDiff: number;
	finalStack: number | undefined;
	totalBuyIn: number;
}) {
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
}

function EndSessionForm({
	chipRemoveTotal,
	defaultFinalStack,
	evDiff,
	onSubmit,
	totalBuyIn,
}: Pick<
	EndSessionSheetProps,
	"chipRemoveTotal" | "defaultFinalStack" | "evDiff" | "onSubmit" | "totalBuyIn"
>) {
	const { form } = useCashGameCompleteForm({ defaultFinalStack, onSubmit });

	return (
		<form
			className="flex flex-col gap-3"
			id={FORM_ID}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="finalStack">
				{(field) => (
					<EndNumericField
						error={field.state.meta.errors[0]?.message}
						id={CASH_OUT_ID}
						label="Cash-out amount"
						name={field.name}
						onBlur={field.handleBlur}
						onChange={field.handleChange}
						required
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.values.finalStack}>
				{(value) => (
					<CashOutSummary
						chipRemoveTotal={chipRemoveTotal}
						evDiff={evDiff}
						finalStack={parseOptionalInt(value)}
						totalBuyIn={totalBuyIn}
					/>
				)}
			</form.Subscribe>
			<EndSheetNote>{END_SHEET_FOOTER}</EndSheetNote>
		</form>
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
	return (
		<CrystFormSheet
			formId={FORM_ID}
			isLoading={isPending}
			onOpenChange={onOpenChange}
			open={open}
			title="End session"
		>
			<EndSessionForm
				chipRemoveTotal={chipRemoveTotal}
				defaultFinalStack={defaultFinalStack}
				evDiff={evDiff}
				onSubmit={onSubmit}
				totalBuyIn={totalBuyIn}
			/>
		</CrystFormSheet>
	);
}
