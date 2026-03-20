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
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	IconCoffee,
	IconGripVertical,
	IconList,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/use-media-query";
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
	onUpdate: (id: string, field: string, value: number | null) => void;
	row: BlindLevelRow;
}

function parseIntOrNull(value: string): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

interface FieldInputProps {
	fieldId: string;
	label: string;
	onSave: (value: number | null) => void;
	placeholder?: string;
	value: number | null;
}

function FieldInput({
	fieldId,
	label,
	value,
	onSave,
	placeholder = "0",
}: FieldInputProps) {
	return (
		<div className="flex flex-col gap-1.5">
			<label
				className="font-medium text-muted-foreground text-xs"
				htmlFor={fieldId}
			>
				{label}
			</label>
			<Input
				className="h-9"
				defaultValue={value ?? ""}
				id={fieldId}
				onBlur={(e) => onSave(parseIntOrNull(e.target.value))}
				placeholder={placeholder}
				type="number"
			/>
		</div>
	);
}

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

	if (row.isBreak) {
		return (
			<div ref={setNodeRef} style={style}>
				<div
					className={`flex items-start gap-3 rounded-lg border bg-muted/40 p-3 ${isEditing ? "ring-2 ring-ring" : ""}`}
				>
					<button
						aria-label="Drag to reorder"
						className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
						type="button"
						{...attributes}
						{...listeners}
					>
						<IconGripVertical size={18} />
					</button>

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
					<div className="mt-1 rounded-lg border bg-card p-3">
						<FieldInput
							fieldId={`${row.id}-minutes`}
							label="Time (min)"
							onSave={(v) => onUpdate(row.id, "minutes", v)}
							value={row.minutes}
						/>
					</div>
				)}
			</div>
		);
	}

	return (
		<div ref={setNodeRef} style={style}>
			<div
				className={`flex items-start gap-3 rounded-lg border bg-card p-3 ${isEditing ? "ring-2 ring-ring" : ""}`}
			>
				<button
					aria-label="Drag to reorder"
					className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
					type="button"
					{...attributes}
					{...listeners}
				>
					<IconGripVertical size={18} />
				</button>

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
				<div className="mt-1 flex flex-col gap-3 rounded-lg border bg-card p-3">
					<FieldInput
						fieldId={`${row.id}-blind1`}
						label={blindLabels.blind1}
						onSave={(v) => onUpdate(row.id, "blind1", v)}
						value={row.blind1}
					/>
					<FieldInput
						fieldId={`${row.id}-blind2`}
						label={blindLabels.blind2}
						onSave={(v) => onUpdate(row.id, "blind2", v)}
						value={row.blind2}
					/>
					<FieldInput
						fieldId={`${row.id}-ante`}
						label="Ante"
						onSave={(v) => onUpdate(row.id, "ante", v)}
						value={row.ante}
					/>
					<FieldInput
						fieldId={`${row.id}-minutes`}
						label="Time (min)"
						onSave={(v) => onUpdate(row.id, "minutes", v)}
						value={row.minutes}
					/>
				</div>
			)}
		</div>
	);
}

interface BlindStructureContentProps {
	onClose: () => void;
	tournamentId: string;
	variant: string;
}

function renderLevelList(
	levelsQuery: { isLoading: boolean },
	levels: BlindLevelRow[],
	blindLabels: { blind1: string; blind2: string; blind3: string },
	editingId: string | null,
	setEditingId: (id: string | null) => void,
	handleDelete: (id: string) => void,
	handleUpdate: (id: string, field: string, value: number | null) => void,
	sensors: ReturnType<typeof useSensors>,
	handleDragEnd: (event: DragEndEvent) => void
) {
	if (levelsQuery.isLoading) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				Loading levels...
			</p>
		);
	}

	if (levels.length === 0) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				No blind levels yet. Add a level to get started.
			</p>
		);
	}

	return (
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
	);
}

function BlindStructureContent({
	tournamentId,
	variant,
	onClose,
}: BlindStructureContentProps) {
	const [isAdding, setIsAdding] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);

	const levelsQuery = useQuery(
		trpc.blindLevel.listByTournament.queryOptions({ tournamentId })
	);
	const levels = levelsQuery.data ?? [];

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

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}
		const oldIndex = levels.findIndex((l) => l.id === active.id);
		const newIndex = levels.findIndex((l) => l.id === over.id);
		if (oldIndex === -1 || newIndex === -1) {
			return;
		}
		const newIds = levels.map((l) => l.id);
		const [moved] = newIds.splice(oldIndex, 1);
		newIds.splice(newIndex, 0, moved);
		await trpcClient.blindLevel.reorder.mutate({
			tournamentId,
			levelIds: newIds,
		});
		await levelsQuery.refetch();
	};

	const handleAddLevel = async () => {
		setIsAdding(true);
		try {
			const nextLevel = levels.length + 1;
			await trpcClient.blindLevel.create.mutate({
				tournamentId,
				level: nextLevel,
				isBreak: false,
			});
			await levelsQuery.refetch();
		} finally {
			setIsAdding(false);
		}
	};

	const handleAddBreak = async () => {
		setIsAdding(true);
		try {
			const nextLevel = levels.length + 1;
			await trpcClient.blindLevel.create.mutate({
				tournamentId,
				level: nextLevel,
				isBreak: true,
			});
			await levelsQuery.refetch();
		} finally {
			setIsAdding(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (editingId === id) {
			setEditingId(null);
		}
		await trpcClient.blindLevel.delete.mutate({ id });
		await levelsQuery.refetch();
	};

	const handleUpdate = async (
		id: string,
		field: string,
		value: number | null
	) => {
		await trpcClient.blindLevel.update.mutate({ id, [field]: value });
		await levelsQuery.refetch();
	};

	return (
		<div className="flex flex-col" style={{ height: "calc(100dvh - 6rem)" }}>
			<div className="flex items-center justify-between border-b px-4 pt-1 pb-3">
				<div className="flex items-center gap-2">
					<IconList className="text-muted-foreground" size={18} />
					<span className="font-semibold text-base">Blind Structure</span>
				</div>
				<button
					aria-label="Close"
					className="text-muted-foreground transition-colors hover:text-foreground"
					onClick={onClose}
					type="button"
				>
					<IconX size={20} />
				</button>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-3">
				{renderLevelList(
					levelsQuery,
					levels,
					blindLabels,
					editingId,
					setEditingId,
					handleDelete,
					handleUpdate,
					sensors,
					handleDragEnd
				)}
			</div>

			<div className="flex gap-2 border-t bg-background px-4 py-3">
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
	const isDesktop = useMediaQuery("(min-width: 768px)");

	const handleClose = () => onOpenChange(false);

	if (isDesktop) {
		return (
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent
					className="max-w-lg overflow-hidden p-0"
					showCloseButton={false}
				>
					<DialogHeader className="sr-only">
						<DialogTitle>Blind Structure</DialogTitle>
					</DialogHeader>
					<BlindStructureContent
						onClose={handleClose}
						tournamentId={tournamentId}
						variant={variant}
					/>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Drawer dismissible={false} onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="h-[calc(100dvh-4rem)]">
				<DrawerHeader className="sr-only">
					<DrawerTitle>Blind Structure</DrawerTitle>
				</DrawerHeader>
				<BlindStructureContent
					onClose={handleClose}
					tournamentId={tournamentId}
					variant={variant}
				/>
			</DrawerContent>
		</Drawer>
	);
}
