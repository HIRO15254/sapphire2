import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { trpc, trpcClient } from "@/utils/trpc";

export interface BlindLevelRow {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	id: string;
	isBreak: boolean;
	level: number;
	minutes: number | null;
	tournamentId: string;
}

interface NewLevelValues {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	minutes: number | null;
}

interface UseBlindLevelsOptions {
	tournamentId: string;
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
				...(newLevel.ante == null ? {} : { ante: newLevel.ante }),
				...(newLevel.minutes == null ? {} : { minutes: newLevel.minutes }),
			}),
		onMutate: async (newLevel) => {
			await queryClient.cancelQueries({
				queryKey: levelsQueryOptions.queryKey,
			});
			const previous = queryClient.getQueryData(levelsQueryOptions.queryKey);
			const tempRow: BlindLevelRow = {
				id: `temp-${Date.now()}`,
				tournamentId,
				level: newLevel.level,
				isBreak: newLevel.isBreak,
				blind1: newLevel.blind1 ?? null,
				blind2: newLevel.blind2 ?? null,
				blind3: null,
				ante: newLevel.ante ?? null,
				minutes: newLevel.minutes ?? null,
			};
			queryClient.setQueryData(
				levelsQueryOptions.queryKey,
				(old: BlindLevelRow[] | undefined) => [...(old ?? []), tempRow]
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(levelsQueryOptions.queryKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: levelsQueryOptions.queryKey });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.blindLevel.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({
				queryKey: levelsQueryOptions.queryKey,
			});
			const previous = queryClient.getQueryData(levelsQueryOptions.queryKey);
			queryClient.setQueryData(
				levelsQueryOptions.queryKey,
				(old: BlindLevelRow[] | undefined) =>
					(old ?? []).filter((l) => l.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(levelsQueryOptions.queryKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: levelsQueryOptions.queryKey });
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({
			id,
			field,
			value,
		}: {
			field: string;
			id: string;
			value: number | null;
		}) => trpcClient.blindLevel.update.mutate({ id, [field]: value }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: levelsQueryOptions.queryKey });
		},
	});

	const reorderMutation = useMutation({
		mutationFn: (levelIds: string[]) =>
			trpcClient.blindLevel.reorder.mutate({ tournamentId, levelIds }),
		onMutate: async (levelIds) => {
			await queryClient.cancelQueries({
				queryKey: levelsQueryOptions.queryKey,
			});
			const previous = queryClient.getQueryData(levelsQueryOptions.queryKey);
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
			if (context?.previous) {
				queryClient.setQueryData(levelsQueryOptions.queryKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: levelsQueryOptions.queryKey });
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

	const handleAddLevel = () => {
		const nextLevel = levels.length + 1;
		addLevelMutation.mutate({
			level: nextLevel,
			isBreak: false,
			...(effectiveLastMinutes == null
				? {}
				: { minutes: effectiveLastMinutes }),
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

	const handleUpdate = (id: string, updates: Record<string, number | null>) => {
		queryClient.setQueryData(
			levelsQueryOptions.queryKey,
			(old: BlindLevelRow[] | undefined) =>
				(old ?? []).map((l) => (l.id === id ? { ...l, ...updates } : l))
		);
		for (const [field, value] of Object.entries(updates)) {
			updateMutation.mutate({ id, field, value });
		}
		if (updates.minutes != null) {
			setLastMinutes(updates.minutes);
		}
	};

	const handleCreateLevel = (values: NewLevelValues) => {
		const nextLevel = levels.length + 1;
		const minutes = values.minutes ?? effectiveLastMinutes;
		addLevelMutation.mutate({
			level: nextLevel,
			isBreak: false,
			blind1: values.blind1,
			blind2: values.blind2,
			ante: values.ante,
			...(minutes == null ? {} : { minutes }),
		});
		if (minutes != null) {
			setLastMinutes(minutes);
		}
	};

	return {
		levels: levels as BlindLevelRow[],
		isLoading: levelsQuery.isLoading,
		isAdding: addLevelMutation.isPending,
		handleDragEnd,
		handleAddLevel,
		handleAddBreak,
		handleDelete,
		handleUpdate,
		handleCreateLevel,
	};
}
