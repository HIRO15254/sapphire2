import {
	useWalletAssets,
	useWalletCategories,
} from "@/features/assets/hooks/use-wallet-data";
import {
	useCreateAdjustment,
	useCreateExchange,
	useUpdateWalletLine,
} from "@/features/assets/hooks/use-wallet-mutations";
import { toInstant } from "@/features/assets/utils/form";
import type {
	AdjustSubmit,
	ExchangeEditSubmit,
	ExchangeSubmit,
	LedgerSheetTarget,
	WalletLine,
} from "./ledger-target";

const TITLES = {
	adjust: "Adjust balance",
	editAdjust: "Edit adjustment",
	editExchange: "Edit exchange",
	exchange: "Exchange",
} as const;

function snapshotOf(line: WalletLine) {
	return {
		categoryId: line.categoryId,
		memo: line.memo,
		occurredAt: toInstant(line.occurredAt),
		quantity: line.quantity,
	};
}

export function useLedgerSheet(
	target: LedgerSheetTarget | null,
	onClose: () => void
) {
	const assetsQuery = useWalletAssets();
	const categoriesQuery = useWalletCategories();
	const createAdjustment = useCreateAdjustment();
	const createExchange = useCreateExchange();
	const updateAdjustment = useUpdateWalletLine("Adjustment updated");
	const updateExchange = useUpdateWalletLine("Exchange updated");

	const onAdjustSubmit = async (values: AdjustSubmit) => {
		if (target?.kind === "editAdjust") {
			await updateAdjustment.mutateAsync(
				{
					categoryId: values.categoryId,
					id: target.line.id,
					memo: values.memo || null,
					occurredAt: values.occurredAt,
					quantity: values.quantity,
				},
				snapshotOf(target.line)
			);
		} else {
			await createAdjustment.mutateAsync({
				assetId: values.assetId,
				occurredAt: values.occurredAt,
				quantity: values.quantity,
				...(values.categoryId ? { categoryId: values.categoryId } : {}),
				...(values.memo ? { memo: values.memo } : {}),
			});
		}
		onClose();
	};

	const onExchangeSubmit = async (values: ExchangeSubmit) => {
		await createExchange.mutateAsync({
			from: values.from,
			occurredAt: values.occurredAt,
			to: values.to,
			...(values.categoryId ? { categoryId: values.categoryId } : {}),
			...(values.memo ? { memo: values.memo } : {}),
		});
		onClose();
	};

	const onExchangeEditSubmit = async (values: ExchangeEditSubmit) => {
		if (target?.kind !== "editExchange") {
			return;
		}
		await updateExchange.mutateAsync(
			{
				categoryId: values.categoryId,
				id: target.line.id,
				memo: values.memo || null,
				occurredAt: values.occurredAt,
				quantity: values.quantity,
			},
			snapshotOf(target.line)
		);
		onClose();
	};

	return {
		assets: assetsQuery.data ?? [],
		categories: categoriesQuery.data ?? [],
		isPending:
			createAdjustment.isPending ||
			createExchange.isPending ||
			updateAdjustment.isPending ||
			updateExchange.isPending,
		isReady: assetsQuery.isSuccess && categoriesQuery.isSuccess,
		onAdjustSubmit,
		onExchangeEditSubmit,
		onExchangeSubmit,
		onOpenChange: (open: boolean) => {
			if (!open) {
				onClose();
			}
		},
		title: target ? TITLES[target.kind] : "",
	};
}
