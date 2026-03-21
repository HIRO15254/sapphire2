import type { DragEndEvent } from "@dnd-kit/core";
import {
	closestCenter,
	DndContext,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	IconCoffee,
	IconGripVertical,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

const GAME_VARIANTS = {
	nlh: {
		label: "NL Hold'em",
		blindLabels: { blind1: "SB", blind2: "BB", blind3: "Straddle" },
	},
} as const;

interface BlindLevelEditorProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	tournamentId: string;
	variant: string;
}

interface BlindLevelRow {
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

interface SortableLevelCardProps {
	blindLabels: { blind1: string; blind2: string; blind3: string };
	editingId: string | null;
	onDelete: (id: string) => void;
	onSetEditing: (id: string | null) => void;
	onUpdate: (id: string, updates: Record<string, number | null>) => void;
	row: BlindLevelRow;
}

function parseIntOrNull(value: string): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

// ---- Local edit state hook ----

interface LocalEditState {
	ante: string;
	blind1: string;
	blind2: string;
	minutes: string;
}

// ---- Level edit form (non-break) ----

interface LevelEditFormProps {
	blindLabels: { blind1: string; blind2: string; blind3: string };
	onBlur: (state: LocalEditState) => void;
	rowId: string;
}

function LevelEditForm({ rowId, blindLabels, onBlur }: LevelEditFormProps) {
	const [state, setState] = useState<LocalEditState>({
		blind1: "",
		blind2: "",
		ante: "",
		minutes: "",
	});

	const handleBlind1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseIntOrNull(val);
		setState((prev) => ({
			...prev,
			blind1: val,
			blind2:
				prev.blind2 || (parsed != null ? String(parsed * 2) : prev.blind2),
			ante: prev.ante || (parsed != null ? String(parsed) : prev.ante),
		}));
	};

	const handleBlind2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseIntOrNull(val);
		setState((prev) => ({
			...prev,
			blind2: val,
			ante: prev.ante || (parsed != null ? String(parsed) : prev.ante),
		}));
	};

	const handleBlur = () => onBlur(state);

	return (
		<div className="mt-1 flex flex-col gap-3 rounded-lg border bg-card p-3">
			<div className="flex flex-col gap-1.5">
				<label
					className="font-medium text-muted-foreground text-xs"
					htmlFor={`${rowId}-blind1`}
				>
					{blindLabels.blind1}
				</label>
				<Input
					className="h-9"
					id={`${rowId}-blind1`}
					onBlur={handleBlur}
					onChange={handleBlind1Change}
					placeholder="0"
					type="number"
					value={state.blind1}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<label
					className="font-medium text-muted-foreground text-xs"
					htmlFor={`${rowId}-blind2`}
				>
					{blindLabels.blind2}
				</label>
				<Input
					className="h-9"
					id={`${rowId}-blind2`}
					onBlur={handleBlur}
					onChange={handleBlind2Change}
					placeholder="0"
					type="number"
					value={state.blind2}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<label
					className="font-medium text-muted-foreground text-xs"
					htmlFor={`${rowId}-ante`}
				>
					Ante
				</label>
				<Input
					className="h-9"
					id={`${rowId}-ante`}
					onBlur={handleBlur}
					onChange={(e) =>
						setState((prev) => ({ ...prev, ante: e.target.value }))
					}
					placeholder="0"
					type="number"
					value={state.ante}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<label
					className="font-medium text-muted-foreground text-xs"
					htmlFor={`${rowId}-minutes`}
				>
					Time (min)
				</label>
				<Input
					className="h-9"
					id={`${rowId}-minutes`}
					onBlur={handleBlur}
					onChange={(e) =>
						setState((prev) => ({ ...prev, minutes: e.target.value }))
					}
					placeholder="0"
					type="number"
					value={state.minutes}
				/>
			</div>
		</div>
	);
}

// ---- Break edit form ----

interface BreakEditFormProps {
	onSave: (minutes: number | null) => void;
	rowId: string;
	value: number | null;
}

function BreakEditForm({ rowId, value, onSave }: BreakEditFormProps) {
	return (
		<div className="mt-1 rounded-lg border bg-card p-3">
			<div className="flex flex-col gap-1.5">
				<label
					className="font-medium text-muted-foreground text-xs"
					htmlFor={`${rowId}-minutes`}
				>
					Time (min)
				</label>
				<Input
					className="h-9"
					defaultValue={value ?? ""}
					id={`${rowId}-minutes`}
					onBlur={(e) => onSave(parseIntOrNull(e.target.value))}
					placeholder="0"
					type="number"
				/>
			</div>
		</div>
	);
}

// ---- Drag handle button ----

interface DragHandleProps {
	attributes: ReturnType<typeof useSortable>["attributes"];
	listeners: ReturnType<typeof useSortable>["listeners"];
}

function DragHandle({ attributes, listeners }: DragHandleProps) {
	return (
		<button
			aria-label="Drag to reorder"
			className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
			type="button"
			{...attributes}
			{...listeners}
		>
			<IconGripVertical size={18} />
		</button>
	);
}

// ---- Main sortable card ----

function SortableLevelCard({
	row,
	blindLabels,
	editingId,
	onSetEditing,
	onDelete,
	onUpdate,
}: SortableLevelCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const isEditing = editingId === row.id;

	const handleCardClick = () => {
		if (!isDragging) {
			onSetEditing(isEditing ? null : row.id);
		}
	};

	const handleLevelBlur = (state: LocalEditState) => {
		onUpdate(row.id, {
			blind1: parseIntOrNull(state.blind1),
			blind2: parseIntOrNull(state.blind2),
			ante: parseIntOrNull(state.ante),
			minutes: parseIntOrNull(state.minutes),
		});
	};

	if (row.isBreak) {
		return (
			<div ref={setNodeRef} style={style}>
				<div
					className={`flex items-start gap-3 rounded-lg border bg-muted/40 p-3 ${isEditing ? "ring-2 ring-ring" : ""}`}
				>
					<DragHandle attributes={attributes} listeners={listeners} />
					<button
						className="flex flex-1 items-center gap-2 text-left"
						onClick={handleCardClick}
						type="button"
					>
						<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs">
							{row.level}
						</span>
						<IconCoffee className="shrink-0 text-muted-foreground" size={16} />
						<span className="font-medium text-sm">Break</span>
						{!isEditing && row.minutes != null && (
							<span className="text-muted-foreground text-sm">
								{row.minutes} min
							</span>
						)}
					</button>
					<button
						aria-label="Delete level"
						className="mt-0.5 text-muted-foreground transition-colors hover:text-destructive"
						onClick={() => onDelete(row.id)}
						type="button"
					>
						<IconTrash size={16} />
					</button>
				</div>
				{isEditing && (
					<BreakEditForm
						onSave={(v) => onUpdate(row.id, { minutes: v })}
						rowId={row.id}
						value={row.minutes}
					/>
				)}
			</div>
		);
	}

	return (
		<div ref={setNodeRef} style={style}>
			<div
				className={`flex items-start gap-3 rounded-lg border bg-card p-3 ${isEditing ? "ring-2 ring-ring" : ""}`}
			>
				<DragHandle attributes={attributes} listeners={listeners} />
				<button
					className="flex flex-1 flex-col gap-1 text-left"
					onClick={handleCardClick}
					type="button"
				>
					<div className="flex items-center gap-2">
						<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
							{row.level}
						</span>
					</div>
					{!isEditing && (
						<div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
							<span className="text-muted-foreground">
								{blindLabels.blind1}:{" "}
								<span className="font-medium text-foreground">
									{row.blind1 ?? "—"}
								</span>
							</span>
							<span className="text-muted-foreground">
								{blindLabels.blind2}:{" "}
								<span className="font-medium text-foreground">
									{row.blind2 ?? "—"}
								</span>
							</span>
							<span className="text-muted-foreground">
								Ante:{" "}
								<span className="font-medium text-foreground">
									{row.ante ?? "—"}
								</span>
							</span>
							<span className="text-muted-foreground">
								Time:{" "}
								<span className="font-medium text-foreground">
									{row.minutes != null ? `${row.minutes} min` : "—"}
								</span>
							</span>
						</div>
					)}
				</button>
				<button
					aria-label="Delete level"
					className="mt-0.5 text-muted-foreground transition-colors hover:text-destructive"
					onClick={() => onDelete(row.id)}
					type="button"
				>
					<IconTrash size={16} />
				</button>
			</div>
			{isEditing && (
				<LevelEditForm
					blindLabels={blindLabels}
					onBlur={handleLevelBlur}
					rowId={row.id}
				/>
			)}
		</div>
	);
}

interface BlindStructureContentProps {
	tournamentId: string;
	variant: string;
}

function BlindStructureContent({
	tournamentId,
	variant,
}: BlindStructureContentProps) {
	const queryClient = useQueryClient();
	const [editingId, setEditingId] = useState<string | null>(null);
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

	const variantKey = (
		variant in GAME_VARIANTS ? variant : "nlh"
	) as keyof typeof GAME_VARIANTS;
	const blindLabels = GAME_VARIANTS[variantKey].blindLabels;

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 8 },
		})
	);

	const addLevelMutation = useMutation({
		mutationFn: (newLevel: {
			isBreak: boolean;
			level: number;
			minutes?: number;
		}) => trpcClient.blindLevel.create.mutate({ tournamentId, ...newLevel }),
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
				blind1: null,
				blind2: null,
				blind3: null,
				ante: null,
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
			if (editingId === id) {
				setEditingId(null);
			}
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
		const reordered = arrayMove(levels, oldIndex, newIndex);
		reorderMutation.mutate(reordered.map((l) => l.id));
	};

	const handleAddLevel = () => {
		const nextLevel = levels.length + 1;
		addLevelMutation.mutate({
			level: nextLevel,
			isBreak: false,
			...(effectiveLastMinutes != null
				? { minutes: effectiveLastMinutes }
				: {}),
		});
	};

	const handleAddBreak = () => {
		const nextLevel = levels.length + 1;
		addLevelMutation.mutate({
			level: nextLevel,
			isBreak: true,
			...(effectiveLastMinutes != null
				? { minutes: effectiveLastMinutes }
				: {}),
		});
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate(id);
	};

	const handleUpdate = (id: string, updates: Record<string, number | null>) => {
		// Optimistically update the cache for all fields at once
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

	const isAdding = addLevelMutation.isPending;

	if (levelsQuery.isLoading) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				Loading levels...
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-2">
				{levels.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No blind levels yet. Add a level to get started.
					</p>
				) : (
					<DndContext
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
						sensors={sensors}
					>
						<SortableContext
							items={levels.map((l) => l.id)}
							strategy={verticalListSortingStrategy}
						>
							<div className="flex flex-col gap-2">
								{levels.map((row) => (
									<SortableLevelCard
										blindLabels={blindLabels}
										editingId={editingId}
										key={row.id}
										onDelete={handleDelete}
										onSetEditing={setEditingId}
										onUpdate={handleUpdate}
										row={row}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				)}
			</div>

			<div className="flex gap-2 border-t bg-background pt-3">
				<Button
					className="flex-1"
					disabled={isAdding}
					onClick={handleAddBreak}
					variant="outline"
				>
					<IconCoffee size={15} />
					Add Break
				</Button>
				<Button className="flex-1" disabled={isAdding} onClick={handleAddLevel}>
					<IconPlus size={15} />
					Add Level
				</Button>
			</div>
		</div>
	);
}

export function BlindLevelEditor({
	tournamentId,
	variant,
	open,
	onOpenChange,
}: BlindLevelEditorProps) {
	return (
		<ResponsiveDialog
			onOpenChange={onOpenChange}
			open={open}
			title="Blind Structure"
		>
			<BlindStructureContent tournamentId={tournamentId} variant={variant} />
		</ResponsiveDialog>
	);
}
