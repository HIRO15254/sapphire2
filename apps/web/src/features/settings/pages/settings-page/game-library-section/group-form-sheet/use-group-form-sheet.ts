import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import z from "zod";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";
import type { GameGroupRow } from "../use-game-library-section";

export interface UseGroupFormSheetProps {
	editingGroup: GameGroupRow | null;
	onOpenChange: (open: boolean) => void;
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

/**
 * Create AND edit share one sheet — mode is derived from `editingGroup`
 * presence. The parent (`use-game-library-section.ts`) keys this sheet by
 * create/edit-target identity so a fresh hook instance mounts per target,
 * seeding `defaultValues` once; `onOpenChange` also resets the form on
 * close so a repeated "Add group" against the same persisted create-mode
 * instance never resurfaces a cancelled draft.
 */
export function useGroupFormSheet({
	editingGroup,
	onOpenChange,
}: UseGroupFormSheetProps) {
	const queryClient = useQueryClient();
	const groupListQueryOptions = trpc.gameGroup.list.queryOptions();
	const variantListQueryOptions = trpc.gameVariant.list.queryOptions();
	const mixListQueryOptions = trpc.gameMix.list.queryOptions();

	// Uniform triple-list invalidation, matching every other mutation in this
	// section (see use-game-library-section.ts's invalidateAll).
	const invalidateAll = () =>
		invalidateTargets(queryClient, [
			{ queryKey: groupListQueryOptions.queryKey },
			{ queryKey: variantListQueryOptions.queryKey },
			{ queryKey: mixListQueryOptions.queryKey },
		]);

	const createMutation = useMutation({
		mutationFn: (input: GroupInput) =>
			trpcClient.gameGroup.create.mutate(input),
		onSuccess: () => {
			form.reset();
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to create game group");
		},
		onSettled: invalidateAll,
	});

	const updateMutation = useMutation({
		mutationFn: (input: GroupInput & { id: string }) =>
			trpcClient.gameGroup.update.mutate(input),
		onSuccess: () => {
			form.reset();
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to update game group");
		},
		onSettled: invalidateAll,
	});

	const form = useForm({
		defaultValues: {
			label: editingGroup?.label ?? "",
			blind1Label: editingGroup?.blind1Label ?? "",
			blind2Label: editingGroup?.blind2Label ?? "",
			blind3Label: editingGroup?.blind3Label ?? "",
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

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			form.reset();
		}
		onOpenChange(open);
	};

	return {
		form,
		formTitle: editingGroup ? "Edit game group" : "Add game group",
		isPending: createMutation.isPending || updateMutation.isPending,
		onOpenChange: handleOpenChange,
	};
}
