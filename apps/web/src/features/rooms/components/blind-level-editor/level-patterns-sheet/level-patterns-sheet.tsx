import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { MixGamesEditor } from "@/shared/components/mix-games-editor";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import type { ResolveGroup } from "@/shared/lib/mix-games";
import { useLevelPatternsSheet } from "./use-level-patterns-sheet";

export type LevelGamesValue = LevelGameGroup[] | null;

interface LevelPatternsSheetProps {
	games: LevelGamesValue;
	/** 1-based level number, for the sheet title. */
	level: number;
	onOpenChange: (open: boolean) => void;
	onSave: (games: LevelGamesValue) => void;
	open: boolean;
	resolveGroup: ResolveGroup;
	resolveVariantLabel: (builtinKey: string) => string | null;
}

/**
 * Bottom sheet editing one blind level's game groups (mix tournaments).
 * Hybrid sheet per web-theme.md: drag handle + visible title, the apply
 * button lives in the body. Done applies the buffered groups via onSave
 * and closes.
 */
export function LevelPatternsSheet({
	level,
	games,
	onOpenChange,
	onSave,
	open,
	resolveGroup,
	resolveVariantLabel,
}: LevelPatternsSheetProps) {
	const { rows, setRows, handleDone } = useLevelPatternsSheet({
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
					Edit the game groups played at level {level}
				</DrawerDescription>
				<div className="flex flex-col gap-3 overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					<MixGamesEditor
						onChange={setRows}
						resolveGroup={resolveGroup}
						resolveVariantLabel={resolveVariantLabel}
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
