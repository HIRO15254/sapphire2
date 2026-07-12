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
	/** Composition the structure is locked to (mode "locked"). */
	lockedLabels?: string[];
	/** "locked" = tournament-wide mix, amounts only; "assign" = per-level variant. */
	mode: "assign" | "locked";
	onOpenChange: (open: boolean) => void;
	onSave: (games: LevelGamesValue) => void;
	open: boolean;
	resolveGroup: ResolveGroup;
}

/**
 * Bottom sheet editing one blind level's game sets (mix tournaments).
 * Hybrid sheet per web-theme.md: drag handle + visible title, the apply
 * button lives in the body. In "assign" mode the level gets its own
 * variant (a mix master gives it several blind sets); in "locked" mode the
 * structure follows the tournament's mix master and only amounts are
 * edited. Done applies the buffered groups via onSave and closes.
 */
export function LevelPatternsSheet({
	compositionFor,
	games,
	level,
	lockedLabels,
	mode,
	onOpenChange,
	onSave,
	open,
	resolveGroup,
}: LevelPatternsSheetProps) {
	const { assignedVariant, handleDone, onAssignVariant, rows, setRows } =
		useLevelPatternsSheet({
			compositionFor,
			games,
			lockedLabels,
			mode,
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
					{mode === "assign" && (
						<Field htmlFor="level-variant" label="Variant">
							<VariantSelect
								id="level-variant"
								includeMix
								onChange={onAssignVariant}
								placeholder="Assign a variant"
								value={assignedVariant}
							/>
						</Field>
					)}
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
