import type { WalletAsset } from "@/features/assets/hooks/use-wallet-data";
import {
	useCreateAsset,
	useUpdateAsset,
} from "@/features/assets/hooks/use-wallet-mutations";
import type { AssetFormSubmit } from "./use-asset-form";

interface UseAssetFormSheetOptions {
	asset: WalletAsset | null;
	onOpenChange: (open: boolean) => void;
}

export function useAssetFormSheet({
	asset,
	onOpenChange,
}: UseAssetFormSheetOptions) {
	const createMutation = useCreateAsset();
	const updateMutation = useUpdateAsset();

	const onSubmit = async (values: AssetFormSubmit) => {
		if (asset) {
			await updateMutation.mutateAsync(
				{
					description: values.description || null,
					id: asset.id,
					name: values.name,
					unit: values.unit || null,
					...(values.kind === asset.kind ? {} : { kind: values.kind }),
					...(values.decimals === asset.decimals
						? {}
						: { decimals: values.decimals }),
				},
				{
					decimals: asset.decimals,
					description: asset.description,
					kind: asset.kind,
					name: asset.name,
					unit: asset.unit,
				}
			);
		} else {
			await createMutation.mutateAsync({
				decimals: values.decimals,
				kind: values.kind,
				name: values.name,
				...(values.description ? { description: values.description } : {}),
				...(values.unit ? { unit: values.unit } : {}),
				...(values.initialRates.length > 0
					? { initialRates: values.initialRates }
					: {}),
			});
		}
		onOpenChange(false);
	};

	return {
		isPending: createMutation.isPending || updateMutation.isPending,
		onSubmit,
	};
}
