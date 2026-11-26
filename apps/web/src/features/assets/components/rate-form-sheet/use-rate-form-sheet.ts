import {
	useWalletAssets,
	useWalletRates,
	useWalletSetting,
} from "@/features/assets/hooks/use-wallet-data";
import { useCreateRate } from "@/features/assets/hooks/use-wallet-mutations";
import type { RateFormSubmit } from "./use-rate-form";

export function useRateFormSheet(baseAssetId: string, onClose: () => void) {
	const assetsQuery = useWalletAssets();
	const ratesQuery = useWalletRates();
	const settingQuery = useWalletSetting();
	const createRate = useCreateRate();

	const onSubmit = async (values: RateFormSubmit) => {
		await createRate.mutateAsync({
			baseAssetId,
			effectiveFrom: values.effectiveFrom,
			quoteAssetId: values.quoteAssetId,
			rateDen: values.rateDen,
			rateNum: values.rateNum,
			...(values.memo ? { memo: values.memo } : {}),
		});
		onClose();
	};

	return {
		assets: assetsQuery.data ?? [],
		baseCurrencyId: settingQuery.data?.baseAssetId ?? null,
		isPending: createRate.isPending,
		isReady: assetsQuery.isSuccess && ratesQuery.isSuccess,
		onOpenChange: (open: boolean) => {
			if (!open) {
				onClose();
			}
		},
		onSubmit,
		rates: ratesQuery.data ?? [],
	};
}
