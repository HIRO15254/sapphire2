import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import z from "zod";
import { useInvalidateGameMasters } from "@/shared/hooks/use-game-groups";
import { trpc, trpcClient } from "@/utils/trpc";

// Local row shapes instead of importing the games-page hook's GameMixRow /
// GameVariantRow — shared components must not import from a feature. Only
// the fields this sheet actually reads are declared; the games-page's rows
// are structurally compatible and pass through unchanged.
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
	/**
	 * Fires with the server-returned row plus this sheet's own id→label
	 * resolution of `games` (unknown ids fall back to the raw id). Callers
	 * reseeding editor rows must prefer `gameLabels` over re-resolving the
	 * ids through their possibly staler variants list (c19).
	 */
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
 * caller's flat variant rows) is the label<->id lookup table. Same
 * key-per-target remount contract as the games-page's group-form-sheet /
 * variant-form-sheet hooks. `onSaved` (optional) fires with the
 * server-returned row after either mutation's success handling, so a
 * caller elsewhere in the app (e.g. a picker that wants to auto-select the
 * mix it just created) can react without this shared component knowing
 * about that caller.
 */
export function useMixFormSheet({
	editingMix,
	onOpenChange,
	onSaved,
	variants,
}: UseMixFormSheetProps) {
	// Uniform triple-list invalidation, matching every other mutation in the
	// games page.
	const invalidateAll = useInvalidateGameMasters();
	const queryClient = useQueryClient();

	// This sheet knows the labels it just saved (it rendered them as chips),
	// so it hands them to onSaved instead of making callers re-resolve the
	// ids against a variants list that may not have refetched yet (c19).
	const labelsForGames = (games: string[]): string[] =>
		games.map((id) => labelById.get(id) ?? id);

	const createMutation = useMutation({
		mutationFn: (input: MixInput) => trpcClient.gameMix.create.mutate(input),
		onSuccess: (created) => {
			form.reset();
			onOpenChange(false);
			onSaved?.(created, labelsForGames(created.games));
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
			onSaved?.(updated, labelsForGames(updated.games));
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

	// VariantSelect seeds a just-created custom variant into the gameVariant.list
	// query cache and then calls onChange -> onAddGame SYNCHRONOUSLY, before this
	// hook's `variants` prop (and thus `idByLabel`) has re-rendered. Resolving
	// against the live cache as a fallback means a brand-new variant created from
	// inside the picker is added to the mix instead of being dropped with a
	// spurious "Failed to add game" (c19).
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
			// Neither the prop list nor the live cache knows this label — a
			// genuinely stale lookup must not swallow the tap silently.
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
