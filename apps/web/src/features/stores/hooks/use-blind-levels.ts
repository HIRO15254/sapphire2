import type { DragEndEvent } from "@dnd-kit/core";
import {
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface BlindLevelRow {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	blindSetId?: number | null;
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

const BLIND_FIELDS = new Set(["blind1", "blind2", "blind3", "ante"]);
const DEFAULT_LIMIT_FORMAT_ID = 1;

async function persistAddLevel(
	tournamentId: string,
	newLevel: {
		ante?: number | null;
		blind1?: number | null;
		blind2?: number | null;
		isBreak: boolean;
		level: number;
		minutes?: number | null;
	}
) {
	const insertedLevel = await trpcClient.tournament.addBlindLevel.mutate({
		tournamentId,
		levelIndex: newLevel.level - 1,
		isBreak: newLevel.isBreak,
		...(newLevel.minutes == null ? {} : { minutes: newLevel.minutes }),
		sortOrder: newLevel.level - 1,
	});
	const hasBlindValues =
		!newLevel.isBreak &&
		((newLevel.blind1 != null && newLevel.blind1 > 0) ||
			(newLevel.blind2 != null && newLevel.blind2 > 0));
	if (hasBlindValues) {
		await trpcClient.tournament.addBlindSet.mutate({
			tournamentBlindLevelId: insertedLevel.id,
			limitFormatId: DEFAULT_LIMIT_FORMAT_ID,
			blind1: newLevel.blind1 ?? 0,
			blind2: newLevel.blind2 ?? 0,
			...(newLevel.ante == null ? {} : { ante: newLevel.ante }),
			sortOrder: 0,
		});
	}
	return insertedLevel;
}

export function useBlindLevels({ tournamentId }: UseBlindLevelsOptions) {
	const queryClient = useQueryClient();
	const [lastMinutes, setLastMinutes] = useState<number | null>(null);

	const levelsQueryOptions = trpc.tournament.listBlindLevels.queryOptions({
		tournamentId,
	});

	const levelsQuery = useQuery(levelsQueryOptions);

	const levels: BlindLevelRow[] = (levelsQuery.data ?? []).map((apiLevel) => {
		const primarySet = apiLevel.blindSets[0];
		return {
			id: String(apiLevel.id),
			tournamentId: apiLevel.tournamentId,
			level: apiLevel.levelIndex + 1,
			isBreak: apiLevel.isBreak,
			blind1: primarySet?.blind1 ?? null,
			blind2: primarySet?.blind2 ?? null,
			blind3: primarySet?.blind3 ?? null,
			ante: primarySet?.ante ?? null,
			minutes: apiLevel.minutes ?? null,
			blindSetId: primarySet?.id ?? null,
		};
	});

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
		}) => persistAddLevel(tournamentId, newLevel),
		onMutate: async (newLevel) => {
			await cancelTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
			const previous = snapshotQuery(queryClient, levelsQueryOptions.queryKey);
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
				blindSetId: null,
			};
			queryClient.setQueryData(
				levelsQueryOptions.queryKey,
				(old: typeof levelsQuery.data) => [
					...(old ?? []),
					{
						id: Number(tempRow.id.replace("temp-", "")) || 0,
						tournamentId: tempRow.tournamentId,
						levelIndex: tempRow.level - 1,
						isBreak: tempRow.isBreak,
						minutes: tempRow.minutes,
						sortOrder: tempRow.level - 1,
						blindSets: [],
					},
				]
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.tournament.removeBlindLevel.mutate({ id: Number(id) }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
			const previous = snapshotQuery(queryClient, levelsQueryOptions.queryKey);
			queryClient.setQueryData(
				levelsQueryOptions.queryKey,
				(old: typeof levelsQuery.data) =>
					(old ?? []).filter((l) => String(l.id) !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
		},
	});

	const updateLevelMutation = useMutation({
		mutationFn: ({
			id,
			field,
			value,
		}: {
			field: string;
			id: string;
			value: number | null;
		}) =>
			trpcClient.tournament.updateBlindLevel.mutate({
				id: Number(id),
				[field]: value,
			}),
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
		},
	});

	const updateBlindSetMutation = useMutation({
		mutationFn: ({
			blindSetId,
			field,
			value,
		}: {
			blindSetId: number;
			field: string;
			value: number | null;
		}) =>
			trpcClient.tournament.updateBlindSet.mutate({
				id: blindSetId,
				[field]: value === null ? undefined : value,
			}),
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
		},
	});

	const createBlindSetMutation = useMutation({
		mutationFn: ({
			levelId,
			values,
		}: {
			levelId: number;
			values: {
				ante?: number | null;
				blind1: number;
				blind2: number;
				blind3?: number | null;
			};
		}) =>
			trpcClient.tournament.addBlindSet.mutate({
				tournamentBlindLevelId: levelId,
				limitFormatId: DEFAULT_LIMIT_FORMAT_ID,
				blind1: values.blind1,
				blind2: values.blind2,
				...(values.blind3 == null ? {} : { blind3: values.blind3 }),
				...(values.ante == null ? {} : { ante: values.ante }),
				sortOrder: 0,
			}),
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
		},
	});

	const reorderMutation = useMutation({
		mutationFn: async (levelIds: string[]) => {
			for (let i = 0; i < levelIds.length; i++) {
				await trpcClient.tournament.updateBlindLevel.mutate({
					id: Number(levelIds[i]),
					sortOrder: i,
				});
			}
		},
		onMutate: async (levelIds) => {
			await cancelTargets(queryClient, [
				{ queryKey: levelsQueryOptions.queryKey },
			]);
			const previous = snapshotQuery(queryClient, levelsQueryOptions.queryKey);
			queryClient.setQueryData(
				levelsQueryOptions.queryKey,
				(old: typeof levelsQuery.data) => {
					if (!old) {
						return old;
					}
					return levelIds
						.map((id) => old.find((l) => String(l.id) === id))
						.filter((l): l is NonNullable<typeof l> => l !== undefined);
				}
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
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

	const applyBlindUpdates = (
		row: BlindLevelRow | undefined,
		blindUpdates: Record<string, number | null>
	) => {
		if (Object.keys(blindUpdates).length === 0) {
			return;
		}
		if (row?.blindSetId == null) {
			const merged = { ...row, ...blindUpdates };
			const blind1 = merged.blind1 ?? 0;
			const blind2 = merged.blind2 ?? 0;
			if (blind1 > 0 || blind2 > 0) {
				createBlindSetMutation.mutate({
					levelId: Number(row?.id ?? 0),
					values: { blind1, blind2, blind3: merged.blind3, ante: merged.ante },
				});
			}
			return;
		}
		for (const [field, value] of Object.entries(blindUpdates)) {
			updateBlindSetMutation.mutate({
				blindSetId: row.blindSetId,
				field,
				value,
			});
		}
	};

	const handleUpdate = (id: string, updates: Record<string, number | null>) => {
		queryClient.setQueryData(
			levelsQueryOptions.queryKey,
			(old: typeof levelsQuery.data) =>
				(old ?? []).map((l) => (String(l.id) === id ? { ...l, ...updates } : l))
		);
		const row = levels.find((l) => l.id === id);
		const blindUpdates: Record<string, number | null> = {};
		for (const [field, value] of Object.entries(updates)) {
			if (BLIND_FIELDS.has(field)) {
				blindUpdates[field] = value;
			} else {
				updateLevelMutation.mutate({ id, field, value });
			}
		}
		applyBlindUpdates(row, blindUpdates);
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

	const sensors = useSensors(
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
		handleCreateLevel,
	};
}
