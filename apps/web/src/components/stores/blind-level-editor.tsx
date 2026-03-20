import {
	IconArrowDown,
	IconArrowUp,
	IconCoffee,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc, trpcClient } from "@/utils/trpc";

const GAME_VARIANTS = {
	nlh: {
		label: "NL Hold'em",
		blindLabels: { blind1: "SB", blind2: "BB", blind3: "Straddle" },
	},
} as const;

interface BlindLevelEditorProps {
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

interface LevelRowProps {
	blindLabels: { blind1: string; blind2: string; blind3: string };
	canMoveDown: boolean;
	canMoveUp: boolean;
	isFirst: boolean;
	isLast: boolean;
	onDelete: (id: string) => void;
	onMoveDown: (id: string) => void;
	onMoveUp: (id: string) => void;
	onUpdate: (id: string, field: string, value: number | null | boolean) => void;
	row: BlindLevelRow;
}

function parseIntOrNull(value: string): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function LevelRow({
	row,
	blindLabels,
	canMoveUp,
	canMoveDown,
	onMoveUp,
	onMoveDown,
	onDelete,
	onUpdate,
}: LevelRowProps) {
	if (row.isBreak) {
		return (
			<div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
				<span className="w-6 shrink-0 text-center text-muted-foreground text-xs">
					{row.level}
				</span>
				<div className="flex flex-1 items-center gap-1 text-muted-foreground text-sm">
					<IconCoffee size={14} />
					<span>Break</span>
				</div>
				<div className="flex flex-col gap-0.5">
					<Input
						className="h-6 w-14 text-xs"
						defaultValue={row.minutes ?? ""}
						onBlur={(e) =>
							onUpdate(row.id, "minutes", parseIntOrNull(e.target.value))
						}
						placeholder="min"
						type="number"
					/>
				</div>
				<div className="flex items-center gap-0.5">
					<Button
						aria-label="Move level up"
						disabled={!canMoveUp}
						onClick={() => onMoveUp(row.id)}
						size="sm"
						variant="ghost"
					>
						<IconArrowUp size={12} />
					</Button>
					<Button
						aria-label="Move level down"
						disabled={!canMoveDown}
						onClick={() => onMoveDown(row.id)}
						size="sm"
						variant="ghost"
					>
						<IconArrowDown size={12} />
					</Button>
					<Button
						aria-label="Delete level"
						className="text-destructive hover:text-destructive"
						onClick={() => onDelete(row.id)}
						size="sm"
						variant="ghost"
					>
						<IconTrash size={12} />
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
			<span className="w-6 shrink-0 text-center text-muted-foreground text-xs">
				{row.level}
			</span>
			<div className="grid flex-1 grid-cols-4 gap-1.5">
				<div className="flex flex-col gap-0.5">
					<span className="text-muted-foreground text-xs">
						{blindLabels.blind1}
					</span>
					<Input
						className="h-6 text-xs"
						defaultValue={row.blind1 ?? ""}
						onBlur={(e) =>
							onUpdate(row.id, "blind1", parseIntOrNull(e.target.value))
						}
						placeholder="0"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-0.5">
					<span className="text-muted-foreground text-xs">
						{blindLabels.blind2}
					</span>
					<Input
						className="h-6 text-xs"
						defaultValue={row.blind2 ?? ""}
						onBlur={(e) =>
							onUpdate(row.id, "blind2", parseIntOrNull(e.target.value))
						}
						placeholder="0"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-0.5">
					<span className="text-muted-foreground text-xs">Ante</span>
					<Input
						className="h-6 text-xs"
						defaultValue={row.ante ?? ""}
						onBlur={(e) =>
							onUpdate(row.id, "ante", parseIntOrNull(e.target.value))
						}
						placeholder="0"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-0.5">
					<span className="text-muted-foreground text-xs">Min</span>
					<Input
						className="h-6 text-xs"
						defaultValue={row.minutes ?? ""}
						onBlur={(e) =>
							onUpdate(row.id, "minutes", parseIntOrNull(e.target.value))
						}
						placeholder="0"
						type="number"
					/>
				</div>
			</div>
			<div className="flex items-center gap-0.5">
				<Button
					aria-label="Move level up"
					disabled={!canMoveUp}
					onClick={() => onMoveUp(row.id)}
					size="sm"
					variant="ghost"
				>
					<IconArrowUp size={12} />
				</Button>
				<Button
					aria-label="Move level down"
					disabled={!canMoveDown}
					onClick={() => onMoveDown(row.id)}
					size="sm"
					variant="ghost"
				>
					<IconArrowDown size={12} />
				</Button>
				<Button
					aria-label="Delete level"
					className="text-destructive hover:text-destructive"
					onClick={() => onDelete(row.id)}
					size="sm"
					variant="ghost"
				>
					<IconTrash size={12} />
				</Button>
			</div>
		</div>
	);
}

export function BlindLevelEditor({
	tournamentId,
	variant,
}: BlindLevelEditorProps) {
	const [isAdding, setIsAdding] = useState(false);

	const levelsQuery = useQuery(
		trpc.blindLevel.listByTournament.queryOptions({ tournamentId })
	);
	const levels = levelsQuery.data ?? [];

	const variantKey = (
		variant in GAME_VARIANTS ? variant : "nlh"
	) as keyof typeof GAME_VARIANTS;
	const blindLabels = GAME_VARIANTS[variantKey].blindLabels;

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
		await trpcClient.blindLevel.delete.mutate({ id });
		await levelsQuery.refetch();
	};

	const handleUpdate = async (
		id: string,
		field: string,
		value: number | null | boolean
	) => {
		await trpcClient.blindLevel.update.mutate({ id, [field]: value });
		await levelsQuery.refetch();
	};

	const handleMoveUp = async (id: string) => {
		const index = levels.findIndex((l) => l.id === id);
		if (index <= 0) {
			return;
		}
		const newIds = levels.map((l) => l.id);
		const temp = newIds[index - 1];
		newIds[index - 1] = newIds[index];
		newIds[index] = temp;
		await trpcClient.blindLevel.reorder.mutate({
			tournamentId,
			levelIds: newIds,
		});
		await levelsQuery.refetch();
	};

	const handleMoveDown = async (id: string) => {
		const index = levels.findIndex((l) => l.id === id);
		if (index < 0 || index >= levels.length - 1) {
			return;
		}
		const newIds = levels.map((l) => l.id);
		const temp = newIds[index + 1];
		newIds[index + 1] = newIds[index];
		newIds[index] = temp;
		await trpcClient.blindLevel.reorder.mutate({
			tournamentId,
			levelIds: newIds,
		});
		await levelsQuery.refetch();
	};

	if (levelsQuery.isLoading) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				Loading levels...
			</p>
		);
	}

	return (
		<div className="mt-3 flex flex-col gap-2">
			<div className="mb-1 flex items-center justify-between">
				<span className="font-medium text-sm">Blind Structure</span>
				<div className="flex gap-1.5">
					<Button
						disabled={isAdding}
						onClick={handleAddBreak}
						size="sm"
						variant="outline"
					>
						<IconCoffee size={13} />
						Break
					</Button>
					<Button disabled={isAdding} onClick={handleAddLevel} size="sm">
						<IconPlus size={13} />
						Level
					</Button>
				</div>
			</div>

			{levels.length === 0 ? (
				<p className="py-3 text-center text-muted-foreground text-xs">
					No blind levels yet. Add a level to get started.
				</p>
			) : (
				<div className="flex flex-col gap-1.5">
					{levels.map((row, index) => (
						<LevelRow
							blindLabels={blindLabels}
							canMoveDown={index < levels.length - 1}
							canMoveUp={index > 0}
							isFirst={index === 0}
							isLast={index === levels.length - 1}
							key={row.id}
							onDelete={handleDelete}
							onMoveDown={handleMoveDown}
							onMoveUp={handleMoveUp}
							onUpdate={handleUpdate}
							row={row}
						/>
					))}
				</div>
			)}
		</div>
	);
}
