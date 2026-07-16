import type {
	DragEndEvent,
	SensorDescriptor,
	SensorOptions,
} from "@dnd-kit/core";
import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type {
	BlindLevelPatch,
	GameSetCellPatch,
	NewLevelValues,
} from "@/features/rooms/utils/blind-level-helpers";
import type { BlindSlotLabels } from "@/shared/hooks/use-variant-labels";
import type { ResolveGroup } from "@/shared/lib/mix-games";

export interface BlindStructureTableProps {
	blindLabels: BlindSlotLabels;
	compositionFor?: (variantLabel: string) => string[];
	defaultGames?: LevelGameGroup[] | null;
	handleAddBreak: () => void;
	handleAddLevel: () => void;
	handleCreateLevel: (values: NewLevelValues) => void;
	handleDelete: (id: string) => void;
	handleDragEnd: (event: DragEndEvent) => void;
	handleUpdate: (id: string, updates: BlindLevelPatch) => void;
	handleUpdateGameSet: (id: string, cell: GameSetCellPatch) => void;
	hybridGames?: boolean;
	isAdding?: boolean;
	isMix?: boolean;
	levels: BlindLevelRow[];
	resolveGroup?: ResolveGroup;
	sensors: SensorDescriptor<SensorOptions>[];
}
