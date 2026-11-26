import type { WalletAsset } from "@/features/assets/hooks/use-wallet-data";
import { FormSheet } from "@/shared/components/form-sheet";
import { AssetForm } from "./asset-form";
import { useAssetFormSheet } from "./use-asset-form-sheet";

const ASSET_FORM_ID = "asset-form";

interface AssetFormSheetProps {
	asset: WalletAsset | null;
	currencies: WalletAsset[];
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function AssetFormSheet({
	asset,
	currencies,
	onOpenChange,
	open,
}: AssetFormSheetProps) {
	const { isPending, onSubmit } = useAssetFormSheet({ asset, onOpenChange });
	return (
		<FormSheet
			confirmLabel={asset ? "Save" : "Create"}
			formId={ASSET_FORM_ID}
			isLoading={isPending}
			onOpenChange={onOpenChange}
			open={open}
			title={asset ? "Edit asset" : "New asset"}
		>
			<AssetForm
				asset={asset}
				currencies={currencies}
				formId={ASSET_FORM_ID}
				onSubmit={onSubmit}
			/>
		</FormSheet>
	);
}
