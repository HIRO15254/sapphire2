import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface GameVariantRow {
	builtinKey: string | null;
	groupId: string;
	id: string;
	label: string;
	shortLabel: string | null;
}

export interface GameGroupOption {
	id: string;
	label: string;
}

export interface GameVariantListItem extends GameVariantRow {
	groupLabel: string;
}

// Mirrors gameVariant.update's server constraints so users get field-level
// errors instead of a server reject.
const editVariantSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	shortLabel: z.string().trim().max(15),
	groupId: z.string().min(1, "Required"),
});

/**
 * Settings-page management of the user's game variants — per-user DB rows
 * seeded at signup and fully editable (mix-game rework). Lists every row,
 * edits one (name / short label / group) via a FormSheet, and deletes one
 * via a destructive confirm. `ring_game.variant` / session snapshots store
 * the display label verbatim, so edits and deletions here never rewrite
 * past games or sessions.
 */
export function useGameVariantsSection() {
	const queryClient = useQueryClient();
	const variantListQueryOptions = trpc.gameVariant.list.queryOptions();
	const variantListQuery = useQuery(variantListQueryOptions);
	const groupListQueryOptions = trpc.gameGroup.list.queryOptions();
	const groupListQuery = useQuery(groupListQueryOptions);

	const [editingVariant, setEditingVariant] = useState<GameVariantRow | null>(
		null
	);
	const [deletingVariant, setDeletingVariant] = useState<GameVariantRow | null>(
		null
	);

	const groups: GameGroupOption[] = (groupListQuery.data ?? []).map(
		(group) => ({ id: group.id, label: group.label })
	);
	const groupLabelById = new Map(
		groups.map((group) => [group.id, group.label])
	);

	const variants: GameVariantListItem[] = (variantListQuery.data ?? []).map(
		(variant) => ({
			id: variant.id,
			builtinKey: variant.builtinKey,
			label: variant.label,
			shortLabel: variant.shortLabel,
			groupId: variant.groupId,
			groupLabel: groupLabelById.get(variant.groupId) ?? "Unknown group",
		})
	);

	const invalidateList = () =>
		invalidateTargets(queryClient, [
			{ queryKey: variantListQueryOptions.queryKey },
		]);

	const updateMutation = useMutation({
		mutationFn: (input: {
			groupId: string;
			id: string;
			label: string;
			shortLabel: string | null;
		}) => trpcClient.gameVariant.update.mutate(input),
		onSuccess: () => {
			setEditingVariant(null);
			form.reset();
		},
		onError: () => {
			toast.error("Failed to update game variant");
		},
		onSettled: invalidateList,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.gameVariant.delete.mutate({ id }),
		onError: () => {
			toast.error("Failed to delete game variant");
		},
		onSettled: invalidateList,
	});

	const form = useForm({
		defaultValues: {
			label: "",
			shortLabel: "",
			groupId: "",
		},
		onSubmit: ({ value }) => {
			if (!editingVariant) {
				return;
			}
			updateMutation.mutate({
				id: editingVariant.id,
				label: value.label.trim(),
				shortLabel: value.shortLabel.trim() || null,
				groupId: value.groupId,
			});
		},
		validators: {
			onSubmit: editVariantSchema,
		},
	});

	const onEdit = (variant: GameVariantRow) => {
		setEditingVariant(variant);
		form.reset();
		form.setFieldValue("label", variant.label);
		form.setFieldValue("shortLabel", variant.shortLabel ?? "");
		form.setFieldValue("groupId", variant.groupId);
	};

	const onEditOpenChange = (open: boolean) => {
		if (!open) {
			setEditingVariant(null);
			form.reset();
		}
	};

	const onDeleteRequest = (variant: GameVariantRow) => {
		setDeletingVariant(variant);
	};

	const onDeleteConfirm = async () => {
		if (!deletingVariant) {
			return;
		}
		try {
			await deleteMutation.mutateAsync(deletingVariant.id);
		} catch {
			// Surfaced via the mutation's onError toast.
		} finally {
			setDeletingVariant(null);
		}
	};

	const onDeleteCancel = () => {
		setDeletingVariant(null);
	};

	return {
		variants,
		groups,
		isLoading: variantListQuery.isLoading || groupListQuery.isLoading,
		form,
		editingVariant,
		onEdit,
		onEditOpenChange,
		isUpdatePending: updateMutation.isPending,
		deletingVariant,
		onDeleteRequest,
		onDeleteConfirm,
		onDeleteCancel,
		isDeletePending: deleteMutation.isPending,
	};
}
