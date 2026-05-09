import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import z from "zod";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface ChipPurchaseOption {
	chips: number;
	cost: number;
	id: number;
	name: string;
	sortOrder: number;
}

const optionSchema = z.object({
	name: z.string().min(1, "Name is required"),
	cost: requiredNumericString({ integer: true, min: 0 }),
	chips: requiredNumericString({ integer: true, min: 0 }),
	sortOrder: optionalNumericString({ integer: true, min: 0 }),
});

interface UseChipPurchaseOptionEditorArgs {
	isReadOnly: boolean;
	options: ChipPurchaseOption[];
	sessionId: string;
}

export function useChipPurchaseOptionEditor({
	sessionId,
	options,
	isReadOnly,
}: UseChipPurchaseOptionEditorArgs) {
	const queryClient = useQueryClient();
	const [editingId, setEditingId] = useState<number | null>(null);
	const [isAddOpen, setIsAddOpen] = useState(false);

	const sessionQueryKey = trpc.liveSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;

	const addForm = useForm({
		defaultValues: {
			name: "",
			cost: "0",
			chips: "0",
			sortOrder: String(options.length),
		},
		onSubmit: ({ value }) => {
			addMutation.mutate({
				name: value.name,
				cost: Number(value.cost),
				chips: Number(value.chips),
				sortOrder: value.sortOrder ? Number(value.sortOrder) : options.length,
			});
		},
		validators: { onSubmit: optionSchema },
	});

	const editForm = useForm({
		defaultValues: {
			name: "",
			cost: "0",
			chips: "0",
			sortOrder: "0",
		},
		onSubmit: ({ value }) => {
			if (editingId === null) {
				return;
			}
			updateMutation.mutate({
				id: editingId,
				name: value.name,
				cost: Number(value.cost),
				chips: Number(value.chips),
				sortOrder: value.sortOrder ? Number(value.sortOrder) : undefined,
			});
		},
		validators: { onSubmit: optionSchema },
	});

	const addMutation = useMutation({
		mutationFn: (values: {
			name: string;
			cost: number;
			chips: number;
			sortOrder: number;
		}) =>
			trpcClient.liveSession.addChipPurchaseOption.mutate({
				sessionId,
				...values,
			}),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
			setIsAddOpen(false);
			addForm.reset();
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: {
			id: number;
			name?: string;
			cost?: number;
			chips?: number;
			sortOrder?: number;
		}) => trpcClient.liveSession.updateChipPurchaseOption.mutate(values),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
			setEditingId(null);
		},
	});

	const removeMutation = useMutation({
		mutationFn: (id: number) =>
			trpcClient.liveSession.removeChipPurchaseOption.mutate({ id }),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
		},
	});

	const openEdit = (option: ChipPurchaseOption) => {
		setEditingId(option.id);
		editForm.reset({
			name: option.name,
			cost: String(option.cost),
			chips: String(option.chips),
			sortOrder: String(option.sortOrder),
		});
	};

	const closeEdit = () => setEditingId(null);

	return {
		options,
		isReadOnly,
		addForm,
		editForm,
		editingId,
		isAddOpen,
		setIsAddOpen,
		openEdit,
		closeEdit,
		isAddPending: addMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		isRemovePending: removeMutation.isPending,
		onRemove: (id: number) => removeMutation.mutate(id),
	};
}
