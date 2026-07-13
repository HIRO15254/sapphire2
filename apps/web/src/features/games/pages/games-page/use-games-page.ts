import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useInvalidateGameMasters } from "@/shared/hooks/use-game-groups";
import { trpc, trpcClient } from "@/utils/trpc";

export interface GameGroupRow {
	blind1Label: string | null;
	blind2Label: string | null;
	blind3Label: string | null;
	builtinKey: string | null;
	id: string;
	label: string;
}

export interface GameVariantRow {
	builtinKey: string | null;
	groupId: string;
	id: string;
	label: string;
	shortLabel: string | null;
	sortOrder: number;
}

export interface GameMixRow {
	builtinKey: string | null;
	games: string[];
	id: string;
	label: string;
}

export interface GameGroupOption {
	id: string;
	label: string;
}

export interface GameGroupEntry {
	group: GameGroupRow;
	variants: GameVariantRow[];
}

type GroupSheetTarget =
	| { mode: "create" }
	| { group: GameGroupRow; mode: "edit" };
type VariantSheetTarget =
	| { groupId: string; mode: "create" }
	| { mode: "edit"; variant: GameVariantRow };
type MixSheetTarget = { mode: "create" } | { mix: GameMixRow; mode: "edit" };

function compareVariants(a: GameVariantRow, b: GameVariantRow): number {
	if (a.sortOrder !== b.sortOrder) {
		return a.sortOrder - b.sortOrder;
	}
	return a.label.localeCompare(b.label);
}

/**
 * Shared confirm/cancel pair for the three delete-confirmation dialogs
 * (group, variant, mix). Each entity's "request" handler stays bespoke
 * (different client-side guards), but confirm/cancel are mechanically
 * identical — mutate by id, surface errors via the mutation's own `onError`
 * toast, and clear the pending-delete state in `finally`/on cancel.
 */
function createDeleteHandlers<TItem extends { id: string }>(
	deletingItem: TItem | null,
	setDeletingItem: (item: TItem | null) => void,
	mutateAsync: (id: string) => Promise<unknown>
) {
	const onConfirm = async () => {
		if (!deletingItem) {
			return;
		}
		try {
			await mutateAsync(deletingItem.id);
		} catch {
			// Surfaced via the mutation's onError toast.
		} finally {
			setDeletingItem(null);
		}
	};
	const onCancel = () => setDeletingItem(null);
	return { onCancel, onConfirm };
}

/**
 * Top-level Games page management of the user's game library — groups and
 * variants merged into one hierarchy (mix-game rework) so "every variant
 * belongs to exactly one group" is visible: one card per group, its
 * variants listed inside, plus a separate card for the user's mix masters
 * (named, reusable game compositions spanning groups). Owns all three list
 * queries, the hierarchy shaping, sheet open/close state, and the delete
 * mutations + the "group in use" guard. The create/edit forms and their own
 * mutations live in the colocated group-form-sheet / variant-form-sheet
 * hooks and the shared mix-form-sheet hook.
 */
export function useGamesPage() {
	const groupListQuery = useQuery(trpc.gameGroup.list.queryOptions());
	const variantListQuery = useQuery(trpc.gameVariant.list.queryOptions());
	const mixListQuery = useQuery(trpc.gameMix.list.queryOptions());

	const [groupSheetTarget, setGroupSheetTarget] =
		useState<GroupSheetTarget | null>(null);
	const [variantSheetTarget, setVariantSheetTarget] =
		useState<VariantSheetTarget | null>(null);
	const [mixSheetTarget, setMixSheetTarget] = useState<MixSheetTarget | null>(
		null
	);
	const [deletingGroup, setDeletingGroup] = useState<GameGroupRow | null>(null);
	const [deletingVariant, setDeletingVariant] = useState<GameVariantRow | null>(
		null
	);
	const [deletingMix, setDeletingMix] = useState<GameMixRow | null>(null);

	const groupRows: GameGroupRow[] = groupListQuery.data ?? [];
	const variantRows: GameVariantRow[] = variantListQuery.data ?? [];
	const mixRows: GameMixRow[] = mixListQuery.data ?? [];

	// Memoized so consumers (list rendering, memoized children) get a stable
	// reference across renders that don't change the underlying query data —
	// these were previously rebuilt from scratch on every render.
	const variantsByGroupId = useMemo(() => {
		const map = new Map<string, GameVariantRow[]>();
		for (const variant of variantRows) {
			const bucket = map.get(variant.groupId);
			if (bucket) {
				bucket.push(variant);
			} else {
				map.set(variant.groupId, [variant]);
			}
		}
		for (const bucket of map.values()) {
			bucket.sort(compareVariants);
		}
		return map;
	}, [variantRows]);

	const groups: GameGroupEntry[] = useMemo(
		() =>
			groupRows.map((group) => ({
				group,
				variants: variantsByGroupId.get(group.id) ?? [],
			})),
		[groupRows, variantsByGroupId]
	);

	const groupOptions: GameGroupOption[] = useMemo(
		() =>
			groupRows.map((group) => ({
				id: group.id,
				label: group.label,
			})),
		[groupRows]
	);

	// Uniform triple-list invalidation: every mutation in this section
	// (groups, variants, AND mixes) invalidates all three lists, since mix
	// composition summaries and the mix-form-sheet's label<->id mapping both
	// read gameVariant.list, and variant/group edits don't change gameMix
	// rows but keep the three lists refetched together for consistency.
	const invalidateAll = useInvalidateGameMasters();

	const deleteGroupMutation = useMutation<unknown, unknown, string>({
		mutationFn: (id: string) => trpcClient.gameGroup.delete.mutate({ id }),
		onError: (error) => {
			// The server rejects with CONFLICT while a variant still
			// references the group (FK `onDelete: "restrict"`) — a race
			// against the client-side guard below, kept as a fallback.
			const message =
				isTRPCClientError(error) && error.data?.code === "CONFLICT"
					? "Remove or reassign its variants first"
					: "Failed to delete game group";
			toast.error(message);
		},
		onSettled: invalidateAll,
	});

	const deleteVariantMutation = useMutation<unknown, unknown, string>({
		mutationFn: (id: string) => trpcClient.gameVariant.delete.mutate({ id }),
		onError: (error) => {
			// The server rejects with CONFLICT while a mix still references the
			// variant (app-level check, no FK) — a race against the client-side
			// guard below, kept as a fallback.
			const message =
				isTRPCClientError(error) && error.data?.code === "CONFLICT"
					? "This variant is used by a game mix. Remove it from the mix first."
					: "Failed to delete game variant";
			toast.error(message);
		},
		onSettled: invalidateAll,
	});

	const deleteMixMutation = useMutation<unknown, unknown, string>({
		mutationFn: (id: string) => trpcClient.gameMix.delete.mutate({ id }),
		onError: () => {
			toast.error("Failed to delete game mix");
		},
		onSettled: invalidateAll,
	});

	const onAddGroup = () => setGroupSheetTarget({ mode: "create" });
	const onEditGroup = (group: GameGroupRow) =>
		setGroupSheetTarget({ group, mode: "edit" });
	const onGroupSheetOpenChange = (open: boolean) => {
		if (!open) {
			setGroupSheetTarget(null);
		}
	};

	const onAddVariant = (groupId: string) =>
		setVariantSheetTarget({ groupId, mode: "create" });
	const onEditVariant = (variant: GameVariantRow) =>
		setVariantSheetTarget({ mode: "edit", variant });
	const onVariantSheetOpenChange = (open: boolean) => {
		if (!open) {
			setVariantSheetTarget(null);
		}
	};

	const onAddMix = () => setMixSheetTarget({ mode: "create" });
	const onEditMix = (mix: GameMixRow) =>
		setMixSheetTarget({ mix, mode: "edit" });
	const onMixSheetOpenChange = (open: boolean) => {
		if (!open) {
			setMixSheetTarget(null);
		}
	};

	const onDeleteGroupRequest = (group: GameGroupRow) => {
		const variants = variantsByGroupId.get(group.id) ?? [];
		if (variants.length > 0) {
			toast.error("Remove or reassign its variants first");
			return;
		}
		setDeletingGroup(group);
	};

	const { onCancel: onDeleteGroupCancel, onConfirm: onDeleteGroupConfirm } =
		createDeleteHandlers(
			deletingGroup,
			setDeletingGroup,
			deleteGroupMutation.mutateAsync
		);

	// A variant referenced by one of the user's mixes cannot be deleted out
	// from under it (mirrors the group-delete guard above); the server's
	// CONFLICT (game-variant.ts) is the fallback for the race where a mix
	// picks up the variant between this check and the request landing.
	const onDeleteVariantRequest = (variant: GameVariantRow) => {
		const usedInMix = mixRows.some((mix) => mix.games.includes(variant.id));
		if (usedInMix) {
			toast.error(
				"This variant is used by a game mix. Remove it from the mix first."
			);
			return;
		}
		setDeletingVariant(variant);
	};

	const { onCancel: onDeleteVariantCancel, onConfirm: onDeleteVariantConfirm } =
		createDeleteHandlers(
			deletingVariant,
			setDeletingVariant,
			deleteVariantMutation.mutateAsync
		);

	const onDeleteMixRequest = (mix: GameMixRow) => setDeletingMix(mix);

	const { onCancel: onDeleteMixCancel, onConfirm: onDeleteMixConfirm } =
		createDeleteHandlers(
			deletingMix,
			setDeletingMix,
			deleteMixMutation.mutateAsync
		);

	return {
		groups,
		groupOptions,
		mixes: mixRows,
		variants: variantRows,
		isLoading:
			groupListQuery.isLoading ||
			variantListQuery.isLoading ||
			mixListQuery.isLoading,

		isGroupSheetOpen: groupSheetTarget !== null,
		editingGroup:
			groupSheetTarget?.mode === "edit" ? groupSheetTarget.group : null,
		onAddGroup,
		onEditGroup,
		onGroupSheetOpenChange,

		isVariantSheetOpen: variantSheetTarget !== null,
		editingVariant:
			variantSheetTarget?.mode === "edit" ? variantSheetTarget.variant : null,
		createGroupId:
			variantSheetTarget?.mode === "create" ? variantSheetTarget.groupId : null,
		onAddVariant,
		onEditVariant,
		onVariantSheetOpenChange,

		isMixSheetOpen: mixSheetTarget !== null,
		editingMix: mixSheetTarget?.mode === "edit" ? mixSheetTarget.mix : null,
		onAddMix,
		onEditMix,
		onMixSheetOpenChange,

		deletingGroup,
		onDeleteGroupRequest,
		onDeleteGroupConfirm,
		onDeleteGroupCancel,
		isDeleteGroupPending: deleteGroupMutation.isPending,

		deletingVariant,
		onDeleteVariantRequest,
		onDeleteVariantConfirm,
		onDeleteVariantCancel,
		isDeleteVariantPending: deleteVariantMutation.isPending,

		deletingMix,
		onDeleteMixRequest,
		onDeleteMixConfirm,
		onDeleteMixCancel,
		isDeleteMixPending: deleteMixMutation.isPending,
	};
}
