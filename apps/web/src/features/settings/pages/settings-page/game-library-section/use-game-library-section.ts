import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";
import { invalidateTargets } from "@/utils/optimistic-update";
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

function compareVariants(a: GameVariantRow, b: GameVariantRow): number {
	if (a.sortOrder !== b.sortOrder) {
		return a.sortOrder - b.sortOrder;
	}
	return a.label.localeCompare(b.label);
}

/**
 * Settings-page management of the user's game library — groups and variants
 * merged into one hierarchy (mix-game rework) so "every variant belongs to
 * exactly one group" is visible: one card per group, its variants listed
 * inside. Owns both list queries, the hierarchy shaping, sheet open/close
 * state, and the delete mutations + the "group in use" guard. The create/
 * edit forms and their own mutations live in the colocated
 * group-form-sheet / variant-form-sheet hooks.
 */
export function useGameLibrarySection() {
	const queryClient = useQueryClient();
	const groupListQueryOptions = trpc.gameGroup.list.queryOptions();
	const groupListQuery = useQuery(groupListQueryOptions);
	const variantListQueryOptions = trpc.gameVariant.list.queryOptions();
	const variantListQuery = useQuery(variantListQueryOptions);

	const [groupSheetTarget, setGroupSheetTarget] =
		useState<GroupSheetTarget | null>(null);
	const [variantSheetTarget, setVariantSheetTarget] =
		useState<VariantSheetTarget | null>(null);
	const [deletingGroup, setDeletingGroup] = useState<GameGroupRow | null>(null);
	const [deletingVariant, setDeletingVariant] = useState<GameVariantRow | null>(
		null
	);

	const groupRows: GameGroupRow[] = groupListQuery.data ?? [];
	const variantRows: GameVariantRow[] = variantListQuery.data ?? [];

	const variantsByGroupId = new Map<string, GameVariantRow[]>();
	for (const variant of variantRows) {
		const bucket = variantsByGroupId.get(variant.groupId);
		if (bucket) {
			bucket.push(variant);
		} else {
			variantsByGroupId.set(variant.groupId, [variant]);
		}
	}
	for (const bucket of variantsByGroupId.values()) {
		bucket.sort(compareVariants);
	}

	const groups: GameGroupEntry[] = groupRows.map((group) => ({
		group,
		variants: variantsByGroupId.get(group.id) ?? [],
	}));

	const groupOptions: GameGroupOption[] = groupRows.map((group) => ({
		id: group.id,
		label: group.label,
	}));

	const invalidateBoth = () =>
		invalidateTargets(queryClient, [
			{ queryKey: groupListQueryOptions.queryKey },
			{ queryKey: variantListQueryOptions.queryKey },
		]);

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
		onSettled: invalidateBoth,
	});

	const deleteVariantMutation = useMutation<unknown, unknown, string>({
		mutationFn: (id: string) => trpcClient.gameVariant.delete.mutate({ id }),
		onError: () => {
			toast.error("Failed to delete game variant");
		},
		onSettled: invalidateBoth,
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

	const onDeleteGroupRequest = (group: GameGroupRow) => {
		const variants = variantsByGroupId.get(group.id) ?? [];
		if (variants.length > 0) {
			toast.error("Remove or reassign its variants first");
			return;
		}
		setDeletingGroup(group);
	};

	const onDeleteGroupConfirm = async () => {
		if (!deletingGroup) {
			return;
		}
		try {
			await deleteGroupMutation.mutateAsync(deletingGroup.id);
		} catch {
			// Surfaced via the mutation's onError toast.
		} finally {
			setDeletingGroup(null);
		}
	};

	const onDeleteGroupCancel = () => setDeletingGroup(null);

	const onDeleteVariantRequest = (variant: GameVariantRow) =>
		setDeletingVariant(variant);

	const onDeleteVariantConfirm = async () => {
		if (!deletingVariant) {
			return;
		}
		try {
			await deleteVariantMutation.mutateAsync(deletingVariant.id);
		} catch {
			// Surfaced via the mutation's onError toast.
		} finally {
			setDeletingVariant(null);
		}
	};

	const onDeleteVariantCancel = () => setDeletingVariant(null);

	return {
		groups,
		groupOptions,
		isLoading: groupListQuery.isLoading || variantListQuery.isLoading,

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
	};
}
