import { FormSheet } from "@/shared/components/form-sheet";
import { RateForm } from "./rate-form";
import type { Effective } from "./use-rate-form";
import { useRateFormSheet } from "./use-rate-form-sheet";

const RATE_FORM_ID = "rate-form";

interface RateFormSheetProps {
	baseAssetId: string;
	defaultEffective: Effective;
	lockedQuoteId: string | null;
	onClose: () => void;
	open: boolean;
}

export function RateFormSheet({
	baseAssetId,
	defaultEffective,
	lockedQuoteId,
	onClose,
	open,
}: RateFormSheetProps) {
	const {
		assets,
		baseCurrencyId,
		isPending,
		isReady,
		onOpenChange,
		onSubmit,
		rates,
	} = useRateFormSheet(baseAssetId, onClose);
	return (
		<FormSheet
			formId={RATE_FORM_ID}
			isLoading={isPending}
			isSaveDisabled={!isReady}
			onOpenChange={onOpenChange}
			open={open}
			title="Add rate"
		>
			{isReady ? (
				<RateForm
					assets={assets}
					baseAssetId={baseAssetId}
					baseCurrencyId={baseCurrencyId}
					defaultEffective={defaultEffective}
					formId={RATE_FORM_ID}
					lockedQuoteId={lockedQuoteId}
					onSubmit={onSubmit}
					rates={rates}
				/>
			) : null}
		</FormSheet>
	);
}
