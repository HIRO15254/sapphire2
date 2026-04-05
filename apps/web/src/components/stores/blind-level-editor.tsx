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
import type { ComponentProps } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
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

const BLIND_LEVEL_INPUT_CLASS =
	"h-8 w-full rounded border-0 bg-transparent text-center text-sm outline-none placeholder:text-muted-foreground/40 focus:bg-accent focus:ring-1 focus:ring-ring";

function parseIntOrNull(value: string): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

// ---- Drag handle ----

interface DragHandleProps {
	attributes: ReturnType<typeof useSortable>["attributes"];
	listeners: ReturnType<typeof useSortable>["listeners"];
}

function DragHandle({ attributes, listeners }: DragHandleProps) {
	return (
		<Button
			aria-label="Drag to reorder"
			className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
			size="icon-xs"
			type="button"
			variant="ghost"
			{...attributes}
			{...listeners}
		>
			<IconGripVertical size={14} />
		</Button>
	);
}

function BlindLevelInput(
	props: ComponentProps<"input"> & { className?: string }
) {
	return (
		<input
			{...props}
			className={cn(BLIND_LEVEL_INPUT_CLASS, props.className)}
		/>
	);
}

// ---- Sortable level row (non-break) ----

interface SortableLevelRowProps {
	onDelete: (id: string) => void;
	onUpdate: (id: string, updates: Record<string, number | null>) => void;
	row: BlindLevelRow;
}

function SortableLevelRow({ row, onDelete, onUpdate }: SortableLevelRowProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row.id });

	// Track current input values for auto-fill logic on blur
	const currentBlind2Ref = useRef(row.blind2 != null ? String(row.blind2) : "");
	const currentAnteRef = useRef(row.ante != null ? String(row.ante) : "");

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const handleBlind1Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseIntOrNull(val);
		const updates: Record<string, number | null> = { blind1: parsed };
		if (parsed != null) {
			if (!currentBlind2Ref.current) {
				const bb = parsed * 2;
				currentBlind2Ref.current = String(bb);
				updates.blind2 = bb;
				if (!currentAnteRef.current) {
					currentAnteRef.current = String(bb);
					updates.ante = bb;
				}
			} else if (!currentAnteRef.current) {
				currentAnteRef.current = String(parsed);
				updates.ante = parsed;
			}
		}
		onUpdate(row.id, updates);
	};

	const handleBlind2Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		currentBlind2Ref.current = val;
		const parsed = parseIntOrNull(val);
		const updates: Record<string, number | null> = { blind2: parsed };
		if (parsed != null && !currentAnteRef.current) {
			currentAnteRef.current = val;
			updates.ante = parsed;
		}
		onUpdate(row.id, updates);
	};

	const handleAnteBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		currentAnteRef.current = e.target.value;
		onUpdate(row.id, { ante: parseIntOrNull(e.target.value) });
	};

	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		onUpdate(row.id, { minutes: parseIntOrNull(e.target.value) });
	};

	return (
		<tr
			className={isDragging ? "opacity-50" : ""}
			ref={setNodeRef}
			style={style}
		>
			<td className="w-10 px-0.5 text-center">
				<div className="flex items-center justify-center gap-0.5">
					<DragHandle attributes={attributes} listeners={listeners} />
					<span className="text-muted-foreground text-xs">{row.level}</span>
				</div>
			</td>
			<td className="px-0.5">
				<BlindLevelInput
					defaultValue={row.blind1 ?? ""}
					inputMode="numeric"
					key={`${row.id}-blind1`}
					onBlur={handleBlind1Blur}
					placeholder="—"
					type="number"
				/>
			</td>
			<td className="px-0.5">
				<BlindLevelInput
					defaultValue={row.blind2 ?? ""}
					inputMode="numeric"
					key={`${row.id}-blind2-${row.blind2}`}
					onBlur={handleBlind2Blur}
					placeholder="—"
					type="number"
				/>
			</td>
			<td className="px-0.5">
				<BlindLevelInput
					defaultValue={row.ante ?? ""}
					inputMode="numeric"
					key={`${row.id}-ante-${row.ante}`}
					onBlur={handleAnteBlur}
					placeholder="—"
					type="number"
				/>
			</td>
			<td className="w-12 px-0.5">
				<BlindLevelInput
					defaultValue={row.minutes ?? ""}
					inputMode="numeric"
					key={`${row.id}-minutes`}
					onBlur={handleMinutesBlur}
					placeholder="—"
					type="number"
				/>
			</td>
			<td className="w-8 px-0.5 text-center">
				<Button
					aria-label="Delete level"
					className="text-muted-foreground hover:text-destructive"
					onClick={() => onDelete(row.id)}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<IconTrash size={14} />
				</Button>
			</td>
		</tr>
	);
}

// ---- Sortable break row ----

interface SortableBreakRowProps {
	onDelete: (id: string) => void;
	onUpdate: (id: string, updates: Record<string, number | null>) => void;
	row: BlindLevelRow;
}

function SortableBreakRow({ row, onDelete, onUpdate }: SortableBreakRowProps) {
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

	return (
		<tr className="bg-muted/30" ref={setNodeRef} style={style}>
			<td className="w-10 px-0.5 text-center">
				<div className="flex items-center justify-center gap-0.5">
					<DragHandle attributes={attributes} listeners={listeners} />
					<span className="text-muted-foreground text-xs">{row.level}</span>
				</div>
			</td>
			<td className="px-1.5 py-1" colSpan={3}>
				<div className="flex items-center gap-1 text-muted-foreground text-sm">
					<IconCoffee size={14} />
					<span>Break</span>
				</div>
			</td>
			<td className="w-12 px-0.5">
				<BlindLevelInput
					defaultValue={row.minutes ?? ""}
					inputMode="numeric"
					key={`${row.id}-minutes`}
					onBlur={(e) =>
						onUpdate(row.id, { minutes: parseIntOrNull(e.target.value) })
					}
					placeholder="—"
					type="number"
				/>
			</td>
			<td className="w-8 px-0.5 text-center">
				<Button
					aria-label="Delete break"
					className="text-muted-foreground hover:text-destructive"
					onClick={() => onDelete(row.id)}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<IconTrash size={14} />
				</Button>
			</td>
		</tr>
	);
}

// ---- Empty bottom row for adding a new level ----

interface NewLevelValues {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	minutes: number | null;
}

interface EmptyRowProps {
	onCreateLevel: (values: NewLevelValues) => void;
}

function EmptyRow({ onCreateLevel }: EmptyRowProps) {
	const blind1Ref = useRef<HTMLInputElement>(null);
	const blind2Ref = useRef<HTMLInputElement>(null);
	const anteRef = useRef<HTMLInputElement>(null);
	const minutesRef = useRef<HTMLInputElement>(null);

	const resetRow = () => {
		for (const ref of [blind1Ref, blind2Ref, anteRef, minutesRef]) {
			if (ref.current) {
				ref.current.value = "";
			}
		}
	};

	const tryCreate = (relatedTarget: EventTarget | null) => {
		const cells = [
			blind1Ref.current,
			blind2Ref.current,
			anteRef.current,
			minutesRef.current,
		];
		if (cells.includes(relatedTarget as HTMLInputElement)) {
			return;
		}
		const blind1Val = parseIntOrNull(blind1Ref.current?.value ?? "");
		if (blind1Val == null) {
			return;
		}
		onCreateLevel({
			blind1: blind1Val,
			blind2: parseIntOrNull(blind2Ref.current?.value ?? ""),
			ante: parseIntOrNull(anteRef.current?.value ?? ""),
			minutes: parseIntOrNull(minutesRef.current?.value ?? ""),
		});
		resetRow();
	};

	const handleBlind1Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseIntOrNull(val);
		if (parsed != null) {
			if (blind2Ref.current && !blind2Ref.current.value) {
				blind2Ref.current.value = String(parsed * 2);
			}
			if (anteRef.current && !anteRef.current.value) {
				anteRef.current.value = blind2Ref.current?.value ?? val;
			}
		}
		tryCreate(e.relatedTarget);
	};

	const handleBlind2Blur = (e: React.FocusEvent<HTMLInputElement>) => {
		const val = e.target.value;
		const parsed = parseIntOrNull(val);
		if (parsed != null && anteRef.current && !anteRef.current.value) {
			anteRef.current.value = val;
		}
		tryCreate(e.relatedTarget);
	};

	const handleAnteBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		tryCreate(e.relatedTarget);
	};

	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		tryCreate(e.relatedTarget);
	};

	return (
		<tr className="border-t border-dashed">
			<td className="w-10 px-0.5 text-center">
				<span className="text-muted-foreground text-xs">+</span>
			</td>
			<td className="px-0.5">
				<BlindLevelInput
					inputMode="numeric"
					onBlur={handleBlind1Blur}
					placeholder="SB"
					ref={blind1Ref}
					type="number"
				/>
			</td>
			<td className="px-0.5">
				<BlindLevelInput
					inputMode="numeric"
					onBlur={handleBlind2Blur}
					placeholder="BB"
					ref={blind2Ref}
					type="number"
				/>
			</td>
			<td className="px-0.5">
				<BlindLevelInput
					inputMode="numeric"
					onBlur={handleAnteBlur}
					placeholder="Ante"
					ref={anteRef}
					type="number"
				/>
			</td>
			<td className="w-12 px-0.5">
				<BlindLevelInput
					inputMode="numeric"
					onBlur={handleMinutesBlur}
					placeholder="Min"
					ref={minutesRef}
					type="number"
				/>
			</td>
			<td className="w-8" />
		</tr>
	);
}

// ---- Main content ----

interface BlindStructureContentProps {
	tournamentId: string;
	variant: string;
}

function BlindStructureContent({
	tournamentId,
	variant,
}: BlindStructureContentProps) {
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
				...(newLevel.blind1 != null ? { blind1: newLevel.blind1 } : {}),
				...(newLevel.blind2 != null ? { blind2: newLevel.blind2 } : {}),
				...(newLevel.ante != null ? { ante: newLevel.ante } : {}),
				...(newLevel.minutes != null ? { minutes: newLevel.minutes } : {}),
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
			...(minutes != null ? { minutes } : {}),
		});
		if (minutes != null) {
			setLastMinutes(minutes);
		}
	};

	if (levelsQuery.isLoading) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				Loading levels...
			</p>
		);
	}

	const isAdding = addLevelMutation.isPending;

	return (
		<div className="flex flex-col gap-3">
			<p className="text-muted-foreground text-sm">
				Drag levels to reorder the structure. Use breaks for scheduled pauses
				between blind levels.
			</p>
			<div className="flex justify-end gap-2">
				<Button
					disabled={isAdding}
					onClick={handleAddBreak}
					size="sm"
					variant="outline"
				>
					<IconCoffee size={14} />
					Break
				</Button>
				<Button disabled={isAdding} onClick={handleAddLevel} size="sm">
					<IconPlus size={14} />
					Level
				</Button>
			</div>

			<div className="w-full overflow-x-auto">
				<table className="w-full table-fixed border-collapse">
					<thead>
						<tr>
							<th className="w-10 pb-1 text-center font-medium text-muted-foreground text-xs">
								#
							</th>
							<th className="pb-1 text-center font-medium text-muted-foreground text-xs">
								{blindLabels.blind1}
							</th>
							<th className="pb-1 text-center font-medium text-muted-foreground text-xs">
								{blindLabels.blind2}
							</th>
							<th className="pb-1 text-center font-medium text-muted-foreground text-xs">
								Ante
							</th>
							<th className="w-12 pb-1 text-center font-medium text-muted-foreground text-xs">
								Min
							</th>
							<th className="w-8 pb-1" />
						</tr>
					</thead>
					<tbody>
						{levels.length > 0 && (
							<DndContext
								collisionDetection={closestCenter}
								onDragEnd={handleDragEnd}
								sensors={sensors}
							>
								<SortableContext
									items={levels.map((l) => l.id)}
									strategy={verticalListSortingStrategy}
								>
									{levels.map((row) =>
										row.isBreak ? (
											<SortableBreakRow
												key={row.id}
												onDelete={handleDelete}
												onUpdate={handleUpdate}
												row={row}
											/>
										) : (
											<SortableLevelRow
												key={row.id}
												onDelete={handleDelete}
												onUpdate={handleUpdate}
												row={row}
											/>
										)
									)}
								</SortableContext>
							</DndContext>
						)}
						<EmptyRow onCreateLevel={handleCreateLevel} />
					</tbody>
				</table>
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
			description="Manage blind levels, breaks, and ordering for this tournament structure."
			fullHeight
			onOpenChange={onOpenChange}
			open={open}
			title="Blind Structure"
		>
			<BlindStructureContent tournamentId={tournamentId} variant={variant} />
		</ResponsiveDialog>
	);
}
