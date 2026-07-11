import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface CustomVariantRow {
	blind1Label: string | null;
	blind2Label: string | null;
	blind3Label: string | null;
	id: string;
	label: string;
}

// Mirrors gameVariant.update's server constraints so users get field-level
// errors instead of a server reject.
const editVariantSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	blind1Label: z.string().trim().max(20),
	blind2Label: z.string().trim().max(20),
	blind3Label: z.string().trim().max(20),
});

/**
 * Settings-page management of user-defined game variants: list, edit (via
 * a FormSheet), and delete (destructive confirm). Definitions only —
 * sessions and games freeze the variant label as a string, so edits and
 * deletions here never rewrite history.
 */
export function useCustomVariantsSection() {
	const queryClient = useQueryClient();
	const listQueryOptions = trpc.gameVariant.list.queryOptions();
	const listQuery = useQuery(listQueryOptions);

	const [editingVariant, setEditingVariant] = useState<CustomVariantRow | null>(
		null
	);
	const [deletingVariant, setDeletingVariant] =
		useState<CustomVariantRow | null>(null);

	const invalidateList = () =>
		invalidateTargets(queryClient, [{ queryKey: listQueryOptions.queryKey }]);

	const updateMutation = useMutation({
		mutationFn: (input: {
			blind1Label: string | null;
			blind2Label: string | null;
			blind3Label: string | null;
			id: string;
			label: string;
		}) => trpcClient.gameVariant.update.mutate(input),
		onSuccess: () => {
			setEditingVariant(null);
			form.reset();
		},
		onError: () => {
			toast.error("Failed to update custom variant");
		},
		onSettled: invalidateList,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.gameVariant.delete.mutate({ id }),
		onError: () => {
			toast.error("Failed to delete custom variant");
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
			if (!editingVariant) {
				return;
			}
			updateMutation.mutate({
				id: editingVariant.id,
				label: value.label.trim(),
				blind1Label: value.blind1Label.trim() || null,
				blind2Label: value.blind2Label.trim() || null,
				blind3Label: value.blind3Label.trim() || null,
			});
		},
		validators: {
			onSubmit: editVariantSchema,
		},
	});

	const onEdit = (variant: CustomVariantRow) => {
		setEditingVariant(variant);
		form.reset();
		form.setFieldValue("label", variant.label);
		form.setFieldValue("blind1Label", variant.blind1Label ?? "");
		form.setFieldValue("blind2Label", variant.blind2Label ?? "");
		form.setFieldValue("blind3Label", variant.blind3Label ?? "");
	};

	const onEditOpenChange = (open: boolean) => {
		if (!open) {
			setEditingVariant(null);
			form.reset();
		}
	};

	const onDeleteRequest = (variant: CustomVariantRow) => {
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
		variants: (listQuery.data ?? []) as CustomVariantRow[],
		isLoading: listQuery.isLoading,
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
