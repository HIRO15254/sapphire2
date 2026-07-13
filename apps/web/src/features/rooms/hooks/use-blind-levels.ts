import type { DragEndEvent } from "@dnd-kit/core";
import {
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	applyGameSetCell,
	type BlindLevelPatch,
	type GameSetCellPatch,
	type NewLevelValues,
} from "@/features/rooms/utils/blind-level-helpers";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateQueryItems,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface BlindLevelRow {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	/** Per-level game groups for mix tournaments; null = single structure. */
	games: LevelGameGroup[] | null;
	id: string;
	isBreak: boolean;
	level: number;
	minutes: number | null;
	tournamentId: string;
}

interface UseBlindLevelsOptions {
	tournamentId: string;
}

interface BlindLevelUpdateVariables {
	cell?: GameSetCellPatch;
	id: string;
	/** Filled in by onMutate after it derives a cell edit from fresh cache. */
	resolvedUpdates?: BlindLevelPatch | null;
	updates?: BlindLevelPatch;
}

export function useBlindLevels({ tournamentId }: UseBlindLevelsOptions) {
	const queryClient = useQueryClient();
	const [lastMinutes, setLastMinutes] = useState<number | null>(null);

	const levelsQueryOptions = trpc.blindLevel.listByTournament.queryOptions({
		tournamentId,
	});

	const levelsQuery = useQuery(levelsQueryOptions);
	const levels = levelsQuery.data ?? [];

	const initialLastMinutes = (() => {
		const data = levelsQuery.data;
		if (!data || data.length === 0) {
			return null;
		}
		for (let i = data.length - 1; i >= 0; i--) {
			if (data[i].minutes != null) {
				return data[i].minutes;
			}
		}
		return null;
	})();

	const effectiveLastMinutes = lastMinutes ?? initialLastMinutes;

	const addLevelMutation = useMutation({
		mutationFn: (newLevel: {
			ante?: number | null;
			blind1?: number | null;
			blind2?: number | null;
			blind3?: number | null;
			games?: LevelGameGroup[] | null;
			isBreak: boolean;
			level: number;
			minutes?: number | null;
		}) =>
			trpcClient.blindLevel.create.mutate({
				tournamentId,
				level: newLevel.level,
				isBreak: newLevel.isBreak,
				...(newLevel.blind1 == null ? {} : { blind1: newLevel.blind1 }),
				...(newLevel.blind2 == null ? {} : { blind2: newLevel.blind2 }),
				...(newLevel.blind3 == null ? {} : { blind3: newLevel.blind3 }),
				...(newLevel.ante == null ? {} : { ante: newLevel.ante }),
				...(newLevel.minutes == null ? {} : { minutes: newLevel.minutes }),
				...(newLevel.games == null ? {} : { games: newLevel.games }),
			}),
		onMutate: async (newLevel) => {
			await cancelTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
			const previous = snapshotQuery(queryClient, levelsQueryOptions.queryKey);
			const tempRow: BlindLevelRow = {
				// crypto-random: `temp-${Date.now()}` collides within one
				// millisecond and corrupts keyed rendering (SA2-143).
				id: `temp-${crypto.randomUUID()}`,
				tournamentId,
				level: newLevel.level,
				isBreak: newLevel.isBreak,
				blind1: newLevel.blind1 ?? null,
				blind2: newLevel.blind2 ?? null,
				blind3: newLevel.blind3 ?? null,
				ante: newLevel.ante ?? null,
				minutes: newLevel.minutes ?? null,
				games: newLevel.games ?? null,
			};
			queryClient.setQueryData(
				levelsQueryOptions.queryKey,
				(old: BlindLevelRow[] | undefined) => [...(old ?? []), tempRow]
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
			toast.error("Failed to create blind level");
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.blindLevel.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
			const previous = snapshotQuery(queryClient, levelsQueryOptions.queryKey);
			queryClient.setQueryData(
				levelsQueryOptions.queryKey,
				(old: BlindLevelRow[] | undefined) =>
					(old ?? []).filter((l) => l.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
			toast.error("Failed to delete blind level");
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
		},
	});

	const updateMutationKey = ["blindLevel", "update", tournamentId] as const;
	const updateMutation = useMutation({
		mutationKey: updateMutationKey,
		// Blur-driven edits to one structure are ordered. This keeps a failed
		// rollback from reverting a later successful cell and lets each game-set
		// edit derive from the previous optimistic result.
		scope: { id: `blind-level-update-${tournamentId}` },
		mutationFn: (
			variables: BlindLevelUpdateVariables
		): Promise<BlindLevelRow | null> => {
			const updates =
				variables.resolvedUpdates === undefined
					? variables.updates
					: variables.resolvedUpdates;
			if (!updates) {
				return Promise.resolve(null);
			}
			return trpcClient.blindLevel.update.mutate({
				id: variables.id,
				...updates,
			});
		},
		onMutate: async (variables: BlindLevelUpdateVariables) => {
			await cancelTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
			const previous = snapshotQuery(queryClient, levelsQueryOptions.queryKey);
			let updates = variables.updates;
			if (variables.cell) {
				const current = queryClient.getQueryData<BlindLevelRow[]>(
					levelsQueryOptions.queryKey
				);
				const row = current?.find((level) => level.id === variables.id);
				const games = applyGameSetCell(row?.games, variables.cell);
				updates = games ? { games } : undefined;
			}
			variables.resolvedUpdates = updates ?? null;
			if (updates) {
				updateQueryItems<BlindLevelRow>(
					queryClient,
					levelsQueryOptions.queryKey,
					(items) =>
						items.map((level) =>
							level.id === variables.id ? { ...level, ...updates } : level
						)
				);
			}
			return { previous, skipped: !updates };
		},
		onError: (_err, _vars, context) => {
			if (!context?.skipped) {
				restoreSnapshots(queryClient, [context?.previous]);
			}
			toast.error("Failed to update blind level");
		},
		onSettled: () => {
			// A scoped mutation currently settling is still counted. Invalidate
			// only for the final queued edit so an intermediate refetch cannot wipe
			// the optimistic base used by the next cell.
			if (queryClient.isMutating({ mutationKey: updateMutationKey }) === 1) {
				invalidateTargets(queryClient, [
					{ queryKey: levelsQueryOptions.queryKey },
				]);
			}
		},
	});

	const reorderMutation = useMutation({
		mutationFn: (levelIds: string[]) =>
			trpcClient.blindLevel.reorder.mutate({ tournamentId, levelIds }),
		onMutate: async (levelIds) => {
			await cancelTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
			const previous = snapshotQuery(queryClient, levelsQueryOptions.queryKey);
			queryClient.setQueryData(
				levelsQueryOptions.queryKey,
				(old: BlindLevelRow[] | undefined) => {
					if (!old) {
						return old;
					}
					return levelIds
						.map((id) => old.find((l) => l.id === id))
						.filter((l): l is BlindLevelRow => l !== undefined);
				}
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
			toast.error("Failed to reorder blind levels");
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
		},
	});

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}
		const oldIndex = levels.findIndex((l) => l.id === active.id);
		const newIndex = levels.findIndex((l) => l.id === over.id);
		if (oldIndex === -1 || newIndex === -1) {
			return;
		}
		const reordered = arrayMove(levels as BlindLevelRow[], oldIndex, newIndex);
		reorderMutation.mutate(reordered.map((l) => l.id));
	};

	const handleAddLevel = (defaultGames?: LevelGameGroup[] | null) => {
		const nextLevel = levels.length + 1;
		addLevelMutation.mutate({
			level: nextLevel,
			isBreak: false,
			...(effectiveLastMinutes == null
				? {}
				: { minutes: effectiveLastMinutes }),
			...(defaultGames == null ? {} : { games: defaultGames }),
		});
	};

	const handleAddBreak = () => {
		const nextLevel = levels.length + 1;
		addLevelMutation.mutate({
			level: nextLevel,
			isBreak: true,
			...(effectiveLastMinutes == null
				? {}
				: { minutes: effectiveLastMinutes }),
		});
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate(id);
	};

	const handleUpdate = (id: string, updates: BlindLevelPatch) => {
		// The server accepts a partial update object, so keep related auto-fill
		// fields atomic instead of splitting them into competing mutations.
		updateMutation.mutate({ id, updates });
		if (updates.minutes != null) {
			setLastMinutes(updates.minutes);
		}
	};

	// A cheap preflight skips impossible edits. The actual games array is
	// derived again inside the serialized onMutate from the freshest cache.
	const handleUpdateGameSet = (id: string, cell: GameSetCellPatch) => {
		const current = queryClient.getQueryData<BlindLevelRow[]>(
			levelsQueryOptions.queryKey
		);
		const row = current?.find((l) => l.id === id);
		if (!applyGameSetCell(row?.games, cell)) {
			return;
		}
		updateMutation.mutate({ id, cell });
	};

	const handleCreateLevel = (values: NewLevelValues) => {
		const nextLevel = levels.length + 1;
		const minutes = values.minutes ?? effectiveLastMinutes;
		addLevelMutation.mutate({
			level: nextLevel,
			isBreak: false,
			blind1: values.blind1,
			blind2: values.blind2,
			blind3: values.blind3,
			ante: values.ante,
			...(minutes == null ? {} : { minutes }),
			...(values.games == null ? {} : { games: values.games }),
		});
		if (minutes != null) {
			setLastMinutes(minutes);
		}
	};

	const sensors = useSensors(
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 8 },
		})
	);

	return {
		levels: levels as BlindLevelRow[],
		isLoading: levelsQuery.isLoading,
		isAdding: addLevelMutation.isPending,
		sensors,
		handleDragEnd,
		handleAddLevel,
		handleAddBreak,
		handleDelete,
		handleUpdate,
		handleUpdateGameSet,
		handleCreateLevel,
	};
}
