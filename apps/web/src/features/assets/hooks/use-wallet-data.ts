import type { AppRouter } from "@sapphire2/api/routers/index";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback } from "react";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

type Outputs = inferRouterOutputs<AppRouter>;

export type WalletAsset = Outputs["asset"]["list"][number];
export type WalletCategory = Outputs["ledgerCategory"]["list"][number];
export type WalletRate = Outputs["assetRate"]["list"][number];
export type WalletSetting = Outputs["userSetting"]["get"];
export type HistoryItem = Outputs["ledger"]["listByAsset"]["items"][number];

export function useWalletAssets() {
	return useQuery(trpc.asset.list.queryOptions({ includeArchived: true }));
}

export function useWalletCategories() {
	return useQuery(
		trpc.ledgerCategory.list.queryOptions({ includeArchived: true })
	);
}

export function useWalletRates() {
	return useQuery(trpc.assetRate.list.queryOptions());
}

export function useWalletSetting() {
	return useQuery(trpc.userSetting.get.queryOptions());
}

export function useInvalidateWallet() {
	const queryClient = useQueryClient();
	return useCallback(
		() =>
			invalidateTargets(queryClient, [
				{ filters: { queryKey: trpc.asset.pathKey() } },
				{ filters: { queryKey: trpc.assetRate.pathKey() } },
				{ filters: { queryKey: trpc.ledger.pathKey() } },
				{ filters: { queryKey: trpc.ledgerCategory.pathKey() } },
				{ filters: { queryKey: trpc.userSetting.pathKey() } },
			]),
		[queryClient]
	);
}
