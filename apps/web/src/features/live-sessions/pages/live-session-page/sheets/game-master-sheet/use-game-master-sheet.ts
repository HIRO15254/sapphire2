import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import {
	useGameGroups,
	useInvalidateGameMasters,
} from "@/shared/hooks/use-game-groups";
import { trpcClient } from "@/utils/trpc";
import { useDiscardConfirm } from "../use-discard-confirm";

export interface GameMasterRow {
	groupId: string;
	id: string;
	label: string;
	shortLabel: string | null;
}

interface GameMasterValues {
	groupId: string;
	label: string;
	shortLabel: string;
}

interface UseGameMasterSheetOptions {
	editing: GameMasterRow | null;
	onOpenChange: (open: boolean) => void;
	onSaved: (label: string) => void;
	open: boolean;
}

const GAME_MASTER_SCHEMA = z.object({
	groupId: z.string().min(1, "Required"),
	label: z.string().trim().min(1, "Required").max(30),
	shortLabel: z.string().trim().max(15),
});

function structureSlots(group: {
	blind1Label: string | null;
	blind2Label: string | null;
	blind3Label: string | null;
}): string {
	return [
		group.blind1Label ?? "SB",
		group.blind2Label ?? "BB",
		group.blind3Label,
	]
		.filter((label): label is string => label !== null)
		.join(" / ");
}

export function useGameMasterSheet({
	editing,
	onOpenChange,
	onSaved,
	open,
}: UseGameMasterSheetOptions) {
	const { groups } = useGameGroups();
	const invalidateMasters = useInvalidateGameMasters();
	const [nameError, setNameError] = useState<string | null>(null);

	const onSaveError = (error: unknown) => {
		if (isTRPCClientError(error) && error.data?.code === "CONFLICT") {
			setNameError(error.message);
			return;
		}
		toast.error(editing ? "Failed to update game" : "Failed to create game");
	};

	const onSaveSuccess = async (saved: { label: string } | undefined) => {
		await invalidateMasters();
		onOpenChange(false);
		if (saved) {
			onSaved(saved.label);
		}
	};

	const saveMutation = useMutation({
		mutationFn: (values: GameMasterValues) => {
			const input = {
				groupId: values.groupId,
				label: values.label.trim(),
				shortLabel: values.shortLabel.trim() || null,
			};
			return editing
				? trpcClient.gameVariant.update.mutate({ id: editing.id, ...input })
				: trpcClient.gameVariant.create.mutate(input);
		},
		onError: onSaveError,
		onSuccess: onSaveSuccess,
	});

	const defaults = (): GameMasterValues => ({
		groupId: editing?.groupId ?? groups[0]?.id ?? "",
		label: editing?.label ?? "",
		shortLabel: editing?.shortLabel ?? "",
	});

	const form = useForm({
		defaultValues: defaults(),
		onSubmit: ({ value }) => {
			setNameError(null);
			saveMutation.mutate(value);
		},
		validators: { onSubmit: GAME_MASTER_SCHEMA },
	});

	const wasOpenRef = useRef(false);
	useEffect(() => {
		if (open && !wasOpenRef.current) {
			form.reset(defaults());
			setNameError(null);
		}
		wasOpenRef.current = open;
	});

	const discard = useDiscardConfirm({
		isDirty: () => form.state.isDirty,
		onOpenChange,
	});

	return {
		discard,
		form,
		hint: editing
			? "This edits the saved game, so every rule and session that uses it shows the change."
			: "The new game is saved to your game list, so you can pick it again later.",
		isSaving: saveMutation.isPending,
		nameError,
		onNameChange: () => setNameError(null),
		structures: groups.map((group) => ({
			id: group.id,
			label: group.label,
			slots: structureSlots(group),
		})),
		title: editing ? "Edit game" : "New game",
	};
}
