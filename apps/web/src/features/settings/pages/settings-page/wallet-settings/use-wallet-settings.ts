import {
	useWalletAssets,
	useWalletSetting,
} from "@/features/assets/hooks/use-wallet-data";
import { useUpdateSetting } from "@/features/assets/hooks/use-wallet-mutations";

const NOT_SET = "none";

const TIME_ZONES = [
	"Asia/Tokyo",
	"Asia/Seoul",
	"Asia/Singapore",
	"Australia/Sydney",
	"Europe/London",
	"America/Los_Angeles",
	"America/New_York",
	"UTC",
];

export function useWalletSettings() {
	const assetsQuery = useWalletAssets();
	const settingQuery = useWalletSetting();
	const baseMutation = useUpdateSetting("Base currency changed");
	const timeZoneMutation = useUpdateSetting("Time zone changed");

	const assets = assetsQuery.data ?? [];
	const baseAssetId = settingQuery.data?.baseAssetId ?? null;
	const timeZone = settingQuery.data?.timeZone ?? null;
	const base = assets.find((asset) => asset.id === baseAssetId);

	const baseOptions = [
		{ label: "Not set", value: NOT_SET },
		...assets
			.filter((asset) => asset.kind === "currency" && asset.archivedAt === null)
			.map((asset) => ({ label: asset.name, value: asset.id })),
		...(base && base.archivedAt !== null
			? [{ label: `${base.name} (archived)`, value: base.id }]
			: []),
	];
	const timeZoneOptions = [
		...(timeZone === null ? [{ label: "Not set", value: NOT_SET }] : []),
		...(timeZone !== null && !TIME_ZONES.includes(timeZone)
			? [{ label: timeZone, value: timeZone }]
			: []),
		...TIME_ZONES.map((zone) => ({ label: zone, value: zone })),
	];

	const run = async (action: () => Promise<unknown>) => {
		try {
			await action();
			// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation handles its own error feedback.
		} catch {}
	};

	return {
		baseOptions,
		baseValue: baseAssetId ?? NOT_SET,
		isError: assetsQuery.isError || settingQuery.isError,
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Query state changes after the initial render.
		isLoading: assetsQuery.isPending || settingQuery.isPending,
		isPending: baseMutation.isPending || timeZoneMutation.isPending,
		isRetrying: assetsQuery.isFetching || settingQuery.isFetching,
		onBaseChange: (value: string) => {
			const next = value === NOT_SET ? null : value;
			if (next === baseAssetId) {
				return;
			}
			run(() =>
				baseMutation.mutateAsync({ baseAssetId: next }, { baseAssetId })
			);
		},
		onRetry: () => {
			assetsQuery.refetch();
			settingQuery.refetch();
		},
		onTimeZoneChange: (value: string) => {
			if (value === NOT_SET || value === timeZone) {
				return;
			}
			run(() =>
				timeZoneMutation.mutateAsync({ timeZone: value }, { timeZone })
			);
		},
		timeZoneOptions,
		timeZoneValue: timeZone ?? NOT_SET,
	};
}
