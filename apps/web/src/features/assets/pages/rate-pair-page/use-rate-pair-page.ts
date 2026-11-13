import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
	useWalletAssets,
	useWalletRates,
	type WalletRate,
} from "@/features/assets/hooks/use-wallet-data";
import { useDeleteRate } from "@/features/assets/hooks/use-wallet-mutations";
import { unitOrName } from "@/features/assets/utils/asset-display";
import { dayLabel, monthKey, monthLabel } from "@/features/assets/utils/dates";
import { formatRate, rateValue } from "@/features/assets/utils/rate";
import {
	currentRate,
	effectiveTime,
	isFromStart,
} from "@/features/assets/utils/rate-pairs";
import { buildRateChart } from "./rate-chart";

interface PairRow {
	current: boolean;
	id: string;
	memo: string | null;
	rate: WalletRate;
	title: string;
	value: string;
}

function buildPairGroups(
	ascending: readonly WalletRate[],
	currentId: string | undefined,
	now: Date,
	formatValue: (rate: WalletRate) => string
) {
	const groups: { key: string; label: string; rows: PairRow[] }[] = [];
	for (const rate of [...ascending].reverse()) {
		const start = isFromStart(rate);
		const at = new Date(rate.effectiveFrom);
		const key = start ? "start" : monthKey(at);
		let group = groups.at(-1);
		if (!group || group.key !== key) {
			group = {
				key,
				label: start ? "From the start" : monthLabel(at),
				rows: [],
			};
			groups.push(group);
		}
		group.rows.push({
			current: rate.id === currentId,
			id: rate.id,
			memo: rate.memo,
			rate,
			title: start ? "Initial rate" : dayLabel(at, now),
			value: formatValue(rate),
		});
	}
	return groups;
}

export function useRatePairPage(baseAssetId: string, quoteAssetId: string) {
	const navigate = useNavigate();
	const ratesQuery = useWalletRates();
	const assetsQuery = useWalletAssets();
	const deleteMutation = useDeleteRate();
	const [menuTarget, setMenuTarget] = useState<WalletRate | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<WalletRate | null>(null);
	const [isFormOpen, setIsFormOpen] = useState(false);

	const assets = assetsQuery.data ?? [];
	const base = assets.find((asset) => asset.id === baseAssetId);
	const quote = assets.find((asset) => asset.id === quoteAssetId);
	const ascending = (ratesQuery.data ?? [])
		.filter(
			(rate) =>
				rate.baseAssetId === baseAssetId && rate.quoteAssetId === quoteAssetId
		)
		.sort((a, b) => effectiveTime(a) - effectiveTime(b));
	const now = new Date();
	const current = currentRate(ascending, now);
	const rateOf = (rate: WalletRate) =>
		rateValue(rate, base?.decimals ?? 0, quote?.decimals ?? 0);
	const quoteUnit = unitOrName(quote);
	const rateText = (rate: WalletRate) =>
		`1 ${unitOrName(base)} = ${formatRate(rateOf(rate))} ${quoteUnit}`;

	const groups = buildPairGroups(
		ascending,
		current?.id,
		now,
		(rate) => `${formatRate(rateOf(rate))} ${quoteUnit}`
	);

	const chart = buildRateChart(
		ascending.map((rate) => ({
			at: effectiveTime(rate),
			value: rateOf(rate),
		})),
		now
	);

	const backToAsset = () =>
		navigate({
			params: { assetId: baseAssetId },
			search: { tab: "rates" },
			to: "/assets/$assetId",
		});

	const onDelete = async () => {
		if (!deleteTarget || deleteMutation.isPending) {
			return;
		}
		const isLast = ascending.length === 1;
		try {
			await deleteMutation.mutateAsync({ id: deleteTarget.id });
			setDeleteTarget(null);
			if (isLast) {
				backToAsset();
			}
			// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation handles its own error feedback.
		} catch {}
	};

	return {
		chart,
		chartLabel: chart
			? `Rate over time, from ${chart.min} to ${chart.max} ${quoteUnit}`
			: "",
		currentValue: current ? formatRate(rateOf(current)) : "",
		deleteTarget,
		groups,
		isDeletePending: deleteMutation.isPending,
		isEmpty: ascending.length === 0,
		isError: ratesQuery.isError || assetsQuery.isError,
		isFormOpen,
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Query state changes after the initial render.
		isLoading: ratesQuery.isPending || assetsQuery.isPending,
		isRetrying: ratesQuery.isFetching || assetsQuery.isFetching,
		label: `1 ${unitOrName(base)} equals`,
		menuTarget,
		menuTitle: menuTarget ? rateText(menuTarget) : "",
		onAddRate: () => setIsFormOpen(true),
		onCloseForm: () => setIsFormOpen(false),
		onDelete,
		onDeleteFromMenu: () => {
			setDeleteTarget(menuTarget);
			setMenuTarget(null);
		},
		onDeleteOpenChange: (open: boolean) => {
			if (!open) {
				setDeleteTarget(null);
			}
		},
		onMenuOpenChange: (open: boolean) => {
			if (!open) {
				setMenuTarget(null);
			}
		},
		onOpenRate: (rate: WalletRate) => () => setMenuTarget(rate),
		onRetry: () => {
			ratesQuery.refetch();
			assetsQuery.refetch();
		},
		quoteUnit,
		title: `${base?.name ?? "?"} → ${quote?.name ?? "?"}`,
	};
}
