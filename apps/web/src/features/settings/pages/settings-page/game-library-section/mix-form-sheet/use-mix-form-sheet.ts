import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import z from "zod";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";
import type { GameMixRow, GameVariantRow } from "../use-game-library-section";

export interface UseMixFormSheetProps {
	editingMix: GameMixRow | null;
	onOpenChange: (open: boolean) => void;
	variants: GameVariantRow[];
}

interface MixInput {
	games: string[];
	label: string;
}

export interface SelectedGame {
	id: string;
	label: string;
}

// Mirrors gameMix.create/update's server constraints so users get
// field-level errors instead of a server reject.
const mixFormSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	games: z.array(z.string()).min(2, "Pick at least 2 games").max(30),
});

/**
 * Create AND edit share one sheet — mode is derived from `editingMix`
 * presence. The UI works entirely in variant LABELS (Badge chips +
 * VariantSelect, both label-based), while the form field and the
 * create/update payload hold ordered game_variant IDS — `variants` (the
 * user's flat variant rows, passed down from use-game-library-section.ts)
 * is the label<->id lookup table. Same key-per-target remount contract as
 * `use-group-form-sheet.ts` / `use-variant-form-sheet.ts`.
 */
export function useMixFormSheet({
	editingMix,
	onOpenChange,
	variants,
}: UseMixFormSheetProps) {
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
		mutationFn: (input: MixInput) => trpcClient.gameMix.create.mutate(input),
		onSuccess: () => {
			form.reset();
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to create game mix");
		},
		onSettled: invalidateAll,
	});

	const updateMutation = useMutation({
		mutationFn: (input: MixInput & { id: string }) =>
			trpcClient.gameMix.update.mutate(input),
		onSuccess: () => {
			form.reset();
			onOpenChange(false);
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

	// `form.state.values.games` is a live getter into the form store — fine to
	// read once at submit time (see onSubmit above), but stale for a rendered
	// value like `selectedGames` unless the read is subscribed via useStore,
	// so the chip list re-renders on every onAddGame/onRemoveGame.
	const games = useStore(form.store, (state) => state.values.games);
	const selectedGames: SelectedGame[] = games.map((id) => ({
		id,
		label: labelById.get(id) ?? id,
	}));

	const onAddGame = (label: string) => {
		const id = idByLabel.get(label);
		if (!id) {
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
