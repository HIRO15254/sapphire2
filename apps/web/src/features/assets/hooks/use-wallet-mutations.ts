import { useRef } from "react";
import { useUndoableMutation } from "@/shared/hooks/use-undoable-mutation";
import { trpc, trpcClient } from "@/utils/trpc";
import { useInvalidateWallet } from "./use-wallet-data";

function useUndoInvalidate() {
	const invalidate = useInvalidateWallet();
	return {
		invalidate,
		undo: async (run: () => Promise<unknown>) => {
			try {
				await run();
			} finally {
				await invalidate();
			}
		},
	};
}

export function useCreateAdjustment() {
	const { invalidate, undo } = useUndoInvalidate();
	return useUndoableMutation(
		trpc.ledger.createAdjustment.mutationOptions({ onSettled: invalidate }),
		{
			inverse: (_variables, line) =>
				undo(() => trpcClient.ledger.delete.mutate({ id: line?.id ?? "" })),
			message: "Balance adjusted",
		}
	);
}

export function useCreateExchange() {
	const { invalidate, undo } = useUndoInvalidate();
	return useUndoableMutation(
		trpc.ledger.createExchange.mutationOptions({ onSettled: invalidate }),
		{
			inverse: (_variables, data) =>
				undo(() =>
					trpcClient.ledger.delete.mutate({ id: data.lines[0]?.id ?? "" })
				),
			message: "Exchange saved",
		}
	);
}

export interface WalletLineSnapshot {
	categoryId: string | null;
	memo: string | null;
	occurredAt: number;
	quantity: number;
}

export function useUpdateWalletLine(message: string) {
	const { invalidate, undo } = useUndoInvalidate();
	const previous = useRef(new Map<string, WalletLineSnapshot>());
	const mutation = useUndoableMutation(
		trpc.ledger.update.mutationOptions({ onSettled: invalidate }),
		{
			inverse: (variables) =>
				undo(() =>
					trpcClient.ledger.update.mutate({
						...(previous.current.get(variables.id) ?? {}),
						id: variables.id,
					})
				),
			message,
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (
			variables: Parameters<typeof mutation.mutateAsync>[0],
			snapshot: WalletLineSnapshot
		) => {
			previous.current.set(variables.id, snapshot);
			return mutation.mutateAsync(variables);
		},
	};
}

export function useDeleteWalletLine(message: string) {
	const invalidate = useInvalidateWallet();
	return useUndoableMutation(
		trpc.ledger.delete.mutationOptions({ onSettled: invalidate }),
		{ destructive: true, message }
	);
}

export function useCreateAsset() {
	const { invalidate, undo } = useUndoInvalidate();
	return useUndoableMutation(
		trpc.asset.create.mutationOptions({ onSettled: invalidate }),
		{
			inverse: (_variables, asset) =>
				undo(() => trpcClient.asset.delete.mutate({ id: asset.id })),
			message: "Asset added",
		}
	);
}

export interface AssetSnapshot {
	decimals: number;
	description: string | null;
	kind: "currency" | "item";
	name: string;
	unit: string | null;
}

export function useUpdateAsset() {
	const { invalidate, undo } = useUndoInvalidate();
	const previous = useRef(new Map<string, AssetSnapshot>());
	const mutation = useUndoableMutation(
		trpc.asset.update.mutationOptions({ onSettled: invalidate }),
		{
			inverse: (variables) => {
				const snapshot = previous.current.get(variables.id);
				return undo(() =>
					trpcClient.asset.update.mutate({
						id: variables.id,
						...(snapshot
							? {
									description: snapshot.description,
									name: snapshot.name,
									unit: snapshot.unit,
									...(variables.kind === undefined
										? {}
										: { kind: snapshot.kind }),
									...(variables.decimals === undefined
										? {}
										: { decimals: snapshot.decimals }),
								}
							: {}),
					})
				);
			},
			message: "Asset updated",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (
			variables: Parameters<typeof mutation.mutateAsync>[0],
			snapshot: AssetSnapshot
		) => {
			previous.current.set(variables.id, snapshot);
			return mutation.mutateAsync(variables);
		},
	};
}

export function useArchiveAsset() {
	const { invalidate, undo } = useUndoInvalidate();
	return useUndoableMutation(
		trpc.asset.archive.mutationOptions({ onSettled: invalidate }),
		{
			inverse: ({ id }) => undo(() => trpcClient.asset.restore.mutate({ id })),
			message: "Asset archived",
		}
	);
}

export function useRestoreAsset() {
	const { invalidate, undo } = useUndoInvalidate();
	return useUndoableMutation(
		trpc.asset.restore.mutationOptions({ onSettled: invalidate }),
		{
			inverse: ({ id }) => undo(() => trpcClient.asset.archive.mutate({ id })),
			message: "Asset restored",
		}
	);
}

export function useToggleFavoriteAsset() {
	const { invalidate, undo } = useUndoInvalidate();
	const added = useUndoableMutation(
		trpc.asset.toggleFavorite.mutationOptions({ onSettled: invalidate }),
		{
			inverse: ({ id }) =>
				undo(() => trpcClient.asset.toggleFavorite.mutate({ id })),
			message: "Added to favorites",
		}
	);
	const removed = useUndoableMutation(
		trpc.asset.toggleFavorite.mutationOptions({ onSettled: invalidate }),
		{
			inverse: ({ id }) =>
				undo(() => trpcClient.asset.toggleFavorite.mutate({ id })),
			message: "Removed from favorites",
		}
	);
	return {
		isPending: added.isPending || removed.isPending,
		mutateAsync: (id: string, isFavorite: boolean) =>
			(isFavorite ? removed : added).mutateAsync({ id }),
	};
}

export function useDeleteAsset() {
	const invalidate = useInvalidateWallet();
	return useUndoableMutation(
		trpc.asset.delete.mutationOptions({ onSettled: invalidate }),
		{ destructive: true, message: "Asset deleted" }
	);
}

export function useCreateRate() {
	const { invalidate, undo } = useUndoInvalidate();
	return useUndoableMutation(
		trpc.assetRate.create.mutationOptions({ onSettled: invalidate }),
		{
			inverse: (_variables, rate) =>
				undo(() => trpcClient.assetRate.delete.mutate({ id: rate?.id ?? "" })),
			message: "Rate added",
		}
	);
}

export function useDeleteRate() {
	const invalidate = useInvalidateWallet();
	return useUndoableMutation(
		trpc.assetRate.delete.mutationOptions({ onSettled: invalidate }),
		{ destructive: true, message: "Rate deleted" }
	);
}

export function useCreateCategory() {
	const { invalidate, undo } = useUndoInvalidate();
	return useUndoableMutation(
		trpc.ledgerCategory.create.mutationOptions({ onSettled: invalidate }),
		{
			inverse: (_variables, category) =>
				undo(() =>
					trpcClient.ledgerCategory.delete.mutate({ id: category.id })
				),
			message: "Category added",
		}
	);
}

export function useUpdateCategory() {
	const { invalidate, undo } = useUndoInvalidate();
	const previous = useRef(
		new Map<string, { icon: string | null; name: string }>()
	);
	const mutation = useUndoableMutation(
		trpc.ledgerCategory.update.mutationOptions({ onSettled: invalidate }),
		{
			inverse: (variables) => {
				const snapshot = previous.current.get(variables.id);
				return undo(() =>
					trpcClient.ledgerCategory.update.mutate({
						icon: snapshot?.icon ?? null,
						id: variables.id,
						name: snapshot?.name ?? variables.name,
					})
				);
			},
			message: "Category updated",
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (
			variables: Parameters<typeof mutation.mutateAsync>[0],
			snapshot: { icon: string | null; name: string }
		) => {
			previous.current.set(variables.id, snapshot);
			return mutation.mutateAsync(variables);
		},
	};
}

export function useArchiveCategory() {
	const { invalidate, undo } = useUndoInvalidate();
	return useUndoableMutation(
		trpc.ledgerCategory.archive.mutationOptions({ onSettled: invalidate }),
		{
			inverse: ({ id }) =>
				undo(() => trpcClient.ledgerCategory.restore.mutate({ id })),
			message: "Category archived",
		}
	);
}

export function useRestoreCategory() {
	const { invalidate, undo } = useUndoInvalidate();
	return useUndoableMutation(
		trpc.ledgerCategory.restore.mutationOptions({ onSettled: invalidate }),
		{
			inverse: ({ id }) =>
				undo(() => trpcClient.ledgerCategory.archive.mutate({ id })),
			message: "Category restored",
		}
	);
}

export function useDeleteCategory() {
	const invalidate = useInvalidateWallet();
	return useUndoableMutation(
		trpc.ledgerCategory.delete.mutationOptions({ onSettled: invalidate }),
		{ destructive: true, message: "Category deleted" }
	);
}

export function useUpdateSetting(message: string) {
	const { invalidate, undo } = useUndoInvalidate();
	const previous = useRef<Record<string, string | null>>({});
	const mutation = useUndoableMutation(
		trpc.userSetting.update.mutationOptions({ onSettled: invalidate }),
		{
			inverse: () =>
				undo(() => trpcClient.userSetting.update.mutate(previous.current)),
			message,
		}
	);
	return {
		isPending: mutation.isPending,
		mutateAsync: (
			variables: { baseAssetId?: string | null; timeZone?: string | null },
			snapshot: Record<string, string | null>
		) => {
			previous.current = snapshot;
			return mutation.mutateAsync(variables);
		},
	};
}
