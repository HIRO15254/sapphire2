import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
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

export interface GameGroupListItem extends GameGroupRow {
	slotSummary: string;
}

interface GroupInput {
	blind1Label: string | null;
	blind2Label: string | null;
	blind3Label: string | null;
	label: string;
}

// Mirrors gameGroup.create/update's server constraints so users get
// field-level errors instead of a server reject.
const groupFormSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	blind1Label: z.string().trim().max(20),
	blind2Label: z.string().trim().max(20),
	blind3Label: z.string().trim().max(20),
});

function slotLabelsSummary(group: {
	blind1Label: string | null;
	blind2Label: string | null;
	blind3Label: string | null;
}): string {
	const labels = [
		group.blind1Label,
		group.blind2Label,
		group.blind3Label,
	].filter(Boolean);
	return labels.length > 0 ? labels.join(" / ") : "Default labels";
}

/**
 * Settings-page management of the user's game groups — per-user DB rows
 * seeded at signup and fully editable (mix-game rework). Lists every row,
 * adds/edits one (name + up to 3 blind-slot labels) via a shared FormSheet,
 * and deletes one via a destructive confirm. A group in use by one of the
 * user's own variants cannot be deleted (server-side `onDelete: "restrict"`
 * guard) — the delete mutation surfaces that as a dedicated toast.
 */
export function useGameGroupsSection() {
	const queryClient = useQueryClient();
	const listQueryOptions = trpc.gameGroup.list.queryOptions();
	const listQuery = useQuery(listQueryOptions);
	const variantListQueryOptions = trpc.gameVariant.list.queryOptions();

	const [editingGroup, setEditingGroup] = useState<GameGroupRow | null>(null);
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [deletingGroup, setDeletingGroup] = useState<GameGroupRow | null>(null);

	const groups: GameGroupListItem[] = (listQuery.data ?? []).map((group) => ({
		id: group.id,
		builtinKey: group.builtinKey,
		label: group.label,
		blind1Label: group.blind1Label,
		blind2Label: group.blind2Label,
		blind3Label: group.blind3Label,
		slotSummary: slotLabelsSummary(group),
	}));

	const invalidateAfterEdit = () =>
		invalidateTargets(queryClient, [
			{ queryKey: listQueryOptions.queryKey },
			{ queryKey: variantListQueryOptions.queryKey },
		]);
	const invalidateList = () =>
		invalidateTargets(queryClient, [{ queryKey: listQueryOptions.queryKey }]);

	const createMutation = useMutation({
		mutationFn: (input: GroupInput) =>
			trpcClient.gameGroup.create.mutate(input),
		onSuccess: () => {
			setIsAddOpen(false);
			form.reset();
		},
		onError: () => {
			toast.error("Failed to create game group");
		},
		onSettled: invalidateAfterEdit,
	});

	const updateMutation = useMutation({
		mutationFn: (input: GroupInput & { id: string }) =>
			trpcClient.gameGroup.update.mutate(input),
		onSuccess: () => {
			setEditingGroup(null);
			form.reset();
		},
		onError: () => {
			toast.error("Failed to update game group");
		},
		onSettled: invalidateAfterEdit,
	});

	const deleteMutation = useMutation<unknown, unknown, string>({
		mutationFn: (id: string) => trpcClient.gameGroup.delete.mutate({ id }),
		onError: (error) => {
			// The server rejects with CONFLICT while a variant still
			// references the group (FK `onDelete: "restrict"`).
			const message =
				isTRPCClientError(error) && error.data?.code === "CONFLICT"
					? "Remove or reassign its variants first"
					: "Failed to delete game group";
			toast.error(message);
		},
		onSettled: invalidateList,
	});

	const form = useForm({
		defaultValues: {
			label: "",
			blind1Label: "",
			blind2Label: "",
			blind3Label: "",
		},
		onSubmit: ({ value }) => {
			const payload: GroupInput = {
				label: value.label.trim(),
				blind1Label: value.blind1Label.trim() || null,
				blind2Label: value.blind2Label.trim() || null,
				blind3Label: value.blind3Label.trim() || null,
			};
			if (editingGroup) {
				updateMutation.mutate({ id: editingGroup.id, ...payload });
			} else {
				createMutation.mutate(payload);
			}
		},
		validators: {
			onSubmit: groupFormSchema,
		},
	});

	const onAdd = () => {
		setEditingGroup(null);
		form.reset();
		setIsAddOpen(true);
	};

	const onEdit = (group: GameGroupRow) => {
		setIsAddOpen(false);
		setEditingGroup(group);
		form.reset();
		form.setFieldValue("label", group.label);
		form.setFieldValue("blind1Label", group.blind1Label ?? "");
		form.setFieldValue("blind2Label", group.blind2Label ?? "");
		form.setFieldValue("blind3Label", group.blind3Label ?? "");
	};

	const onFormOpenChange = (open: boolean) => {
		if (!open) {
			setIsAddOpen(false);
			setEditingGroup(null);
			form.reset();
		}
	};

	const onDeleteRequest = (group: GameGroupRow) => {
		setDeletingGroup(group);
	};

	const onDeleteConfirm = async () => {
		if (!deletingGroup) {
			return;
		}
		try {
			await deleteMutation.mutateAsync(deletingGroup.id);
		} catch {
			// Surfaced via the mutation's onError toast.
		} finally {
			setDeletingGroup(null);
		}
	};

	const onDeleteCancel = () => {
		setDeletingGroup(null);
	};

	return {
		groups,
		isLoading: listQuery.isLoading,
		form,
		isFormOpen: isAddOpen || editingGroup !== null,
		formTitle: editingGroup ? "Edit game group" : "Add game group",
		isFormPending: createMutation.isPending || updateMutation.isPending,
		onAdd,
		onEdit,
		onFormOpenChange,
		deletingGroup,
		onDeleteRequest,
		onDeleteConfirm,
		onDeleteCancel,
		isDeletePending: deleteMutation.isPending,
	};
}
