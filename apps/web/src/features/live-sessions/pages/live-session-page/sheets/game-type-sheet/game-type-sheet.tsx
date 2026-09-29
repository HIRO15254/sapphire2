import {
	IconArrowBackUp,
	IconLayoutGrid,
	IconPencil,
	IconPlus,
} from "@tabler/icons-react";
import {
	CRYST_TAB,
	CRYST_TAB_LIST,
	crystButton,
	onCrystTabListKeyDown,
} from "../../cryst-controls";
import { RadioCard, RadioCardGroup } from "../../radio-card";
import { VariantPickList } from "../../variant-pick-list";
import { CrystSheet } from "../cryst-sheet";
import { GameMasterSheet } from "../game-master-sheet";
import { MixMasterSheet } from "../mix-master-sheet";
import {
	type GameTypeTarget,
	type PickedMix,
	useGameTypeSheet,
} from "./use-game-type-sheet";

interface GameTypeSheetProps {
	onClear?: () => void;
	onOpenChange: (open: boolean) => void;
	onPickMix: (mix: PickedMix) => void;
	onPickVariant: (label: string) => void;
	open: boolean;
	target: GameTypeTarget;
}

const tabId = (key: string) => `cryst-game-type-tab-${key}`;
const PANEL_ID = "cryst-game-type-panel";
const PRESET_LABEL_ID = "cryst-game-type-presets";
const SECTION_LABEL_CLASS =
	"font-medium text-[length:var(--text-xs)] text-muted-foreground uppercase tracking-[var(--tracking-caps)]";
const HINT_CLASS =
	"text-pretty text-[length:var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]";

interface MasterActionsProps {
	editLabel: string;
	newLabel: string;
	onEdit: (() => void) | null;
	onNew: () => void;
}

function MasterActions({
	editLabel,
	newLabel,
	onEdit,
	onNew,
}: MasterActionsProps) {
	return (
		<div className="grid grid-cols-2 gap-2">
			<button
				className={crystButton({ variant: "outline" })}
				onClick={onNew}
				type="button"
			>
				<IconPlus aria-hidden size={16} />
				{newLabel}
			</button>
			<button
				className={crystButton({ variant: "outline" })}
				disabled={onEdit === null}
				onClick={onEdit ?? undefined}
				type="button"
			>
				<IconPencil aria-hidden size={16} />
				{editLabel}
			</button>
		</div>
	);
}

export function GameTypeSheet({
	onClear,
	onOpenChange,
	onPickMix,
	onPickVariant,
	open,
	target,
}: GameTypeSheetProps) {
	const sheet = useGameTypeSheet({ onPickMix, onPickVariant, open, target });

	return (
		<>
			<CrystSheet
				header={
					<div
						aria-label="Game type kind"
						className={CRYST_TAB_LIST}
						onKeyDown={onCrystTabListKeyDown}
						role="tablist"
					>
						{sheet.modes.map((mode) => (
							<button
								aria-controls={PANEL_ID}
								aria-selected={mode.isActive}
								className={CRYST_TAB}
								id={tabId(mode.key)}
								key={mode.key}
								onClick={() => sheet.onSelectMode(mode.key)}
								role="tab"
								tabIndex={mode.isActive ? 0 : -1}
								type="button"
							>
								{mode.label}
							</button>
						))}
					</div>
				}
				onOpenChange={onOpenChange}
				open={open}
				title={sheet.title}
			>
				<div className="flex flex-col gap-3">
					<div
						aria-labelledby={tabId(sheet.mode)}
						className="flex flex-col gap-3"
						id={PANEL_ID}
						role="tabpanel"
					>
						{sheet.mode === "single" ? (
							<>
								<VariantPickList
									isPicked={sheet.isPicked}
									onPick={onPickVariant}
								/>
								<MasterActions
									editLabel="Edit game"
									newLabel="New game"
									onEdit={sheet.onEditGame}
									onNew={sheet.onNewGame}
								/>
							</>
						) : (
							<>
								<div className="flex flex-col gap-1.5">
									<span className={SECTION_LABEL_CLASS} id={PRESET_LABEL_ID}>
										Saved mixes
									</span>
									{sheet.isCustomMix ? (
										<p className={HINT_CLASS} role="status">
											This uses a custom mix that is not in your game list. It
											stays as it is until you pick a game.
										</p>
									) : null}
									{sheet.presets.length === 0 ? (
										<p className={HINT_CLASS}>No saved mixes yet</p>
									) : (
										<RadioCardGroup
											aria-labelledby={PRESET_LABEL_ID}
											onValueChange={sheet.onPickPreset}
											value={sheet.selectedMix}
										>
											{sheet.presets.map((preset) => (
												<RadioCard
													description={preset.games}
													icon={IconLayoutGrid}
													key={preset.label}
													title={preset.label}
													value={preset.label}
												/>
											))}
										</RadioCardGroup>
									)}
								</div>
								<MasterActions
									editLabel="Edit mix"
									newLabel="New mix"
									onEdit={sheet.onEditMix}
									onNew={sheet.onNewMix}
								/>
								<p className={HINT_CLASS}>{sheet.mixedHint}</p>
							</>
						)}
					</div>
					{sheet.clearLabel && onClear ? (
						<button
							className={crystButton({ variant: "ghost" })}
							onClick={onClear}
							type="button"
						>
							<IconArrowBackUp aria-hidden size={16} />
							{sheet.clearLabel}
						</button>
					) : null}
				</div>
			</CrystSheet>
			<GameMasterSheet
				editing={sheet.gameSheet.editing}
				onOpenChange={sheet.gameSheet.onOpenChange}
				onSaved={sheet.gameSheet.onSaved}
				open={sheet.gameSheet.open}
			/>
			<MixMasterSheet
				editing={sheet.mixSheet.editing}
				onOpenChange={sheet.mixSheet.onOpenChange}
				onSaved={sheet.mixSheet.onSaved}
				open={sheet.mixSheet.open}
			/>
		</>
	);
}
