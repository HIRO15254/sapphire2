import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type SensorDescriptor,
	type SensorOptions,
} from "@dnd-kit/core";
import {
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
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useLocalBlindStructure } from "@/stores/hooks/use-blind-level-editor";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import { useBlindLevels } from "@/stores/hooks/use-blind-levels";
import { useEmptyRow } from "@/stores/hooks/use-empty-row";
import { useSortableLevelRow } from "@/stores/hooks/use-sortable-level-row";
import type { NewLevelValues } from "@/stores/utils/blind-level-helpers";

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

	const {
		handleBlind1Blur,
		handleBlind2Blur,
		handleAnteBlur,
		handleMinutesBlur,
	} = useSortableLevelRow({ row, onUpdate });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
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

interface EmptyRowProps {
	onCreateLevel: (values: NewLevelValues) => void;
}

function EmptyRow({ onCreateLevel }: EmptyRowProps) {
	const {
		blind1Ref,
		blind2Ref,
		anteRef,
		minutesRef,
		handleBlind1Blur,
		handleBlind2Blur,
		handleAnteBlur,
		handleMinutesBlur,
	} = useEmptyRow({ onCreateLevel });

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

// ---- Shared table JSX ----

interface BlindStructureTableProps {
	blindLabels: { blind1: string; blind2: string; blind3: string };
	handleAddBreak: () => void;
	handleAddLevel: () => void;
	handleCreateLevel: (values: NewLevelValues) => void;
	handleDelete: (id: string) => void;
	handleDragEnd: (event: DragEndEvent) => void;
	handleUpdate: (id: string, updates: Record<string, number | null>) => void;
	isAdding?: boolean;
	levels: BlindLevelRow[];
	sensors: SensorDescriptor<SensorOptions>[];
}

function BlindStructureTable({
	levels,
	blindLabels,
	sensors,
	isAdding = false,
	handleDragEnd,
	handleAddBreak,
	handleAddLevel,
	handleDelete,
	handleUpdate,
	handleCreateLevel,
}: BlindStructureTableProps) {
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

// ---- Main content (API-backed) ----

interface BlindStructureContentProps {
	tournamentId: string;
	variant: string;
}

export function BlindStructureContent({
	tournamentId,
	variant,
}: BlindStructureContentProps) {
	const {
		levels,
		isLoading,
		isAdding,
		sensors,
		handleDragEnd,
		handleAddLevel,
		handleAddBreak,
		handleDelete,
		handleUpdate,
		handleCreateLevel,
	} = useBlindLevels({ tournamentId });

	const variantKey = (
		variant in GAME_VARIANTS ? variant : "nlh"
	) as keyof typeof GAME_VARIANTS;
	const blindLabels = GAME_VARIANTS[variantKey].blindLabels;

	if (isLoading) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				Loading levels...
			</p>
		);
	}

	return (
		<BlindStructureTable
			blindLabels={blindLabels}
			handleAddBreak={handleAddBreak}
			handleAddLevel={handleAddLevel}
			handleCreateLevel={handleCreateLevel}
			handleDelete={handleDelete}
			handleDragEnd={handleDragEnd}
			handleUpdate={handleUpdate}
			isAdding={isAdding}
			levels={levels}
			sensors={sensors}
		/>
	);
}

// ---- Local-state content (for create modal) ----

interface LocalBlindStructureContentProps {
	onChange: (levels: BlindLevelRow[]) => void;
	value: BlindLevelRow[];
	variant?: string;
}

export function LocalBlindStructureContent({
	value,
	onChange,
	variant = "nlh",
}: LocalBlindStructureContentProps) {
	const {
		sensors,
		handleDragEnd,
		handleAddLevel,
		handleAddBreak,
		handleDelete,
		handleUpdate,
		handleCreateLevel,
	} = useLocalBlindStructure({ value, onChange });

	const variantKey = (
		variant in GAME_VARIANTS ? variant : "nlh"
	) as keyof typeof GAME_VARIANTS;
	const blindLabels = GAME_VARIANTS[variantKey].blindLabels;

	return (
		<BlindStructureTable
			blindLabels={blindLabels}
			handleAddBreak={handleAddBreak}
			handleAddLevel={handleAddLevel}
			handleCreateLevel={handleCreateLevel}
			handleDelete={handleDelete}
			handleDragEnd={handleDragEnd}
			handleUpdate={handleUpdate}
			levels={value}
			sensors={sensors}
		/>
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
