import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import z from "zod";
import { useInvalidateGameMasters } from "@/shared/hooks/use-game-groups";
import { trpc, trpcClient } from "@/utils/trpc";

export interface MixFormMixRow {
	builtinKey: string | null;
	games: string[];
	id: string;
	label: string;
}

export interface MixFormVariantRow {
	id: string;
	label: string;
}

export interface UseMixFormSheetProps {
	editingMix: MixFormMixRow | null;
	onOpenChange: (open: boolean) => void;
	onSaved?: (
		mix: { id: string; label: string; games: string[] },
		gameLabels: string[]
	) => void;
	variants: MixFormVariantRow[];
}

interface MixInput {
	games: string[];
	label: string;
}

export interface SelectedGame {
	id: string;
	label: string;
}

const mixFormSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	games: z.array(z.string()).min(2, "Pick at least 2 games").max(30),
});

export function useMixFormSheet({
	editingMix,
	onOpenChange,
	onSaved,
	variants,
}: UseMixFormSheetProps) {
	const invalidateAll = useInvalidateGameMasters();
	const queryClient = useQueryClient();

	const labelsForGames = (games: string[]): string[] =>
		games.map((id) => labelById.get(id) ?? id);

	const createMutation = useMutation({
		mutationFn: (input: MixInput) => trpcClient.gameMix.create.mutate(input),
		onSuccess: (created) => {
			form.reset();
			onOpenChange(false);
			if (created) {
				onSaved?.(created, labelsForGames(created.games));
			}
		},
		onError: () => {
			toast.error("Failed to create game mix");
		},
		onSettled: invalidateAll,
	});

	const updateMutation = useMutation({
		mutationFn: (input: MixInput & { id: string }) =>
			trpcClient.gameMix.update.mutate(input),
		onSuccess: (updated) => {
			form.reset();
			onOpenChange(false);
			if (updated) {
				onSaved?.(updated, labelsForGames(updated.games));
			}
		},
		onError: () => {
			toast.error("Failed to update game mix");
		},
		onSettled: invalidateAll,
	});

	const labelById = new Map(
		variants.map((variant) => [variant.id, variant.label])
	);
	const idByLabel = new Map(
		variants.map((variant) => [variant.label, variant.id])
	);

	const form = useForm({
		defaultValues: {
			label: editingMix?.label ?? "",
			games: editingMix?.games ?? [],
		},
		onSubmit: ({ value }) => {
			const payload: MixInput = {
				label: value.label.trim(),
				games: value.games,
			};
			if (editingMix) {
				updateMutation.mutate({ id: editingMix.id, ...payload });
			} else {
				createMutation.mutate(payload);
			}
		},
		validators: {
			onSubmit: mixFormSchema,
		},
	});

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			form.reset();
		}
		onOpenChange(open);
	};

	const games = useStore(form.store, (state) => state.values.games);
	const selectedGames: SelectedGame[] = games.map((id) => ({
		id,
		label: labelById.get(id) ?? id,
	}));

	const resolveGameId = (label: string): string | undefined => {
		const fromProp = idByLabel.get(label);
		if (fromProp) {
			return fromProp;
		}
		const cached = queryClient.getQueryData(
			trpc.gameVariant.list.queryOptions().queryKey
		) as MixFormVariantRow[] | undefined;
		return cached?.find((variant) => variant.label === label)?.id;
	};

	const onAddGame = (label: string) => {
		const id = resolveGameId(label);
		if (!id) {
			toast.error("Failed to add game");
			return;
		}
		const current = form.getFieldValue("games");
		if (current.includes(id)) {
			return;
		}
		form.setFieldValue("games", [...current, id]);
	};

	const onRemoveGame = (id: string) => {
		const current = form.getFieldValue("games");
		form.setFieldValue(
			"games",
			current.filter((gameId) => gameId !== id)
		);
	};

	return {
		form,
		formTitle: editingMix ? "Edit game mix" : "Add game mix",
		isPending: createMutation.isPending || updateMutation.isPending,
		onAddGame,
		onOpenChange: handleOpenChange,
		onRemoveGame,
		selectedGames,
	};
}
