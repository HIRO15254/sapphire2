import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import z from "zod";
import { useInvalidateGameMasters } from "@/shared/hooks/use-game-groups";
import { trpcClient } from "@/utils/trpc";
import type { GameGroupOption, GameVariantRow } from "../use-games-page";

export interface UseVariantFormSheetProps {
	createGroupId: string | null;
	editingVariant: GameVariantRow | null;
	groups: GameGroupOption[];
	onOpenChange: (open: boolean) => void;
}

interface VariantInput {
	groupId: string;
	label: string;
	shortLabel: string | null;
}

const variantFormSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	shortLabel: z.string().trim().max(15),
	groupId: z.string().min(1, "Required"),
});

export function useVariantFormSheet({
	createGroupId,
	editingVariant,
	groups,
	onOpenChange,
}: UseVariantFormSheetProps) {
	const invalidateAll = useInvalidateGameMasters();

	const createMutation = useMutation({
		mutationFn: (input: VariantInput) =>
			trpcClient.gameVariant.create.mutate(input),
		onSuccess: () => {
			form.reset();
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to create game variant");
		},
		onSettled: invalidateAll,
	});

	const updateMutation = useMutation({
		mutationFn: (input: VariantInput & { id: string }) =>
			trpcClient.gameVariant.update.mutate(input),
		onSuccess: () => {
			form.reset();
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to update game variant");
		},
		onSettled: invalidateAll,
	});

	const form = useForm({
		defaultValues: {
			label: editingVariant?.label ?? "",
			shortLabel: editingVariant?.shortLabel ?? "",
			groupId: editingVariant?.groupId ?? createGroupId ?? "",
		},
		onSubmit: ({ value }) => {
			const payload: VariantInput = {
				label: value.label.trim(),
				shortLabel: value.shortLabel.trim() || null,
				groupId: value.groupId,
			};
			if (editingVariant) {
				updateMutation.mutate({ id: editingVariant.id, ...payload });
			} else {
				createMutation.mutate(payload);
			}
		},
		validators: {
			onSubmit: variantFormSchema,
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			form.reset();
		}
		onOpenChange(open);
	};

	return {
		form,
		formTitle: editingVariant ? "Edit game variant" : "Add game variant",
		groups,
		isPending: createMutation.isPending || updateMutation.isPending,
		onOpenChange: handleOpenChange,
	};
}
