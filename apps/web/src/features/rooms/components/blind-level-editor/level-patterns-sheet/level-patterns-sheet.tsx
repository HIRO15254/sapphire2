import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { MixGamesEditor } from "@/shared/components/mix-games-editor";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Field } from "@/shared/components/ui/field";
import { VariantSelect } from "@/shared/components/variant-select";
import type { ResolveGroup } from "@/shared/lib/mix-games";
import { useLevelPatternsSheet } from "./use-level-patterns-sheet";

export type LevelGamesValue = LevelGameGroup[] | null;

interface LevelPatternsSheetProps {
	/** Variant label → the games it stands for (mix composition or itself). */
	compositionFor: (variantLabel: string) => string[];
	games: LevelGamesValue;
	/** 1-based level number, for the sheet title. */
	level: number;
	onOpenChange: (open: boolean) => void;
	onSave: (games: LevelGamesValue) => void;
	open: boolean;
	resolveGroup: ResolveGroup;
}

/**
 * Bottom sheet editing one blind level's game sets (per-level-variant
 * tournaments). Hybrid sheet per web-theme.md: drag handle + visible
 * title, the apply button lives in the body. The level gets its own
 * variant, picked here — a mix master gives it several blind sets. Done
 * applies the buffered groups via onSave and closes.
 */
export function LevelPatternsSheet({
	compositionFor,
	games,
	level,
	onOpenChange,
	onSave,
	open,
	resolveGroup,
}: LevelPatternsSheetProps) {
	const { assignedVariant, handleDone, onAssignVariant, rows, setRows } =
		useLevelPatternsSheet({
			compositionFor,
			games,
			onSave,
			open,
			resolveGroup,
		});

	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent>
				<div className="mx-auto h-1 w-9 rounded-full bg-muted-foreground/35" />
				<DrawerTitle className="t-h4 px-4 pt-3">
					Level {level} games
				</DrawerTitle>
				<DrawerDescription className="sr-only">
					Edit the games played at level {level}
				</DrawerDescription>
				<div className="flex flex-col gap-3 overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					<Field htmlFor="level-variant" label="Variant">
						<VariantSelect
							id="level-variant"
							includeMix
							onChange={onAssignVariant}
							placeholder="Assign a variant"
							value={assignedVariant}
						/>
					</Field>
					<MixGamesEditor
						onChange={setRows}
						resolveGroup={resolveGroup}
						showAnteType={false}
						value={rows}
					/>
					<Button
						onClick={() => {
							handleDone();
							onOpenChange(false);
						}}
						type="button"
					>
						Done
					</Button>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
