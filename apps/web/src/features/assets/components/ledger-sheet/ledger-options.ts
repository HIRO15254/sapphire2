import type { SelectOption } from "@/features/assets/components/form-fields";
import type {
	WalletAsset,
	WalletCategory,
} from "@/features/assets/hooks/use-wallet-data";

export const NO_CATEGORY = "none";

export function assetOptions(
	assets: readonly WalletAsset[],
	currentId: string
): SelectOption[] {
	return assets.flatMap((asset) => {
		if (asset.archivedAt === null) {
			return [{ label: asset.name, value: asset.id }];
		}
		return asset.id === currentId
			? [{ label: `${asset.name} (archived)`, value: asset.id }]
			: [];
	});
}

export function categoryOptions(
	categories: readonly WalletCategory[],
	currentId: string
): SelectOption[] {
	return [
		{ label: "No category", value: NO_CATEGORY },
		...categories.flatMap((category) => {
			if (category.archivedAt === null) {
				return [{ label: category.name, value: category.id }];
			}
			return category.id === currentId
				? [{ label: `${category.name} (archived)`, value: category.id }]
				: [];
		}),
	];
}

export function categoryValue(value: string): string | null {
	return value === NO_CATEGORY ? null : value;
}
