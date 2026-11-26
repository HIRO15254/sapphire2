import { FormSheet } from "@/shared/components/form-sheet";
import { AdjustForm } from "./adjust-form";
import { ExchangeEditForm } from "./exchange-edit-form";
import { ExchangeForm } from "./exchange-form";
import type { LedgerSheetTarget } from "./ledger-target";
import { useLedgerSheet } from "./use-ledger-sheet";

const LEDGER_FORM_ID = "ledger-form";

interface LedgerSheetProps {
	onClose: () => void;
	target: LedgerSheetTarget | null;
}

export function LedgerSheet({ onClose, target }: LedgerSheetProps) {
	const {
		assets,
		categories,
		isPending,
		isReady,
		onAdjustSubmit,
		onExchangeEditSubmit,
		onExchangeSubmit,
		onOpenChange,
		title,
	} = useLedgerSheet(target, onClose);

	function renderForm() {
		if (!(target && isReady)) {
			return null;
		}
		switch (target.kind) {
			case "adjust":
				return (
					<AdjustForm
						assetId={target.assetId}
						assets={assets}
						categories={categories}
						formId={LEDGER_FORM_ID}
						line={null}
						lockAsset={target.lockAsset}
						onSubmit={onAdjustSubmit}
					/>
				);
			case "editAdjust":
				return (
					<AdjustForm
						assetId={target.line.assetId}
						assets={assets}
						categories={categories}
						formId={LEDGER_FORM_ID}
						line={target.line}
						lockAsset
						onSubmit={onAdjustSubmit}
					/>
				);
			case "exchange":
				return (
					<ExchangeForm
						assets={assets}
						categories={categories}
						formId={LEDGER_FORM_ID}
						fromId={target.fromId}
						onSubmit={onExchangeSubmit}
					/>
				);
			case "editExchange":
				return (
					<ExchangeEditForm
						assets={assets}
						categories={categories}
						counterpart={target.counterpart}
						formId={LEDGER_FORM_ID}
						line={target.line}
						onSubmit={onExchangeEditSubmit}
					/>
				);
			default:
				return null;
		}
	}

	return (
		<FormSheet
			formId={LEDGER_FORM_ID}
			isLoading={isPending}
			isSaveDisabled={!isReady}
			onOpenChange={onOpenChange}
			open={target !== null}
			title={title}
		>
			{renderForm()}
		</FormSheet>
	);
}
