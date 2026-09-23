import { MIX_VARIANT } from "@sapphire2/db/constants/game-variants";
import type { MixGameGroup } from "@sapphire2/db/schemas/game";
import {
	IconAdjustments,
	IconAdjustmentsHorizontal,
	IconLayoutGrid,
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
import { useGameTypeSheet } from "./use-game-type-sheet";

interface GameTypeSheetProps {
	isCash: boolean;
	mixGames: MixGameGroup[] | null;
	onEditComposition: () => void;
	onOpenChange: (open: boolean) => void;
	onPickMix: (value: string) => void;
	onPickVariant: (label: string) => void;
	open: boolean;
	variant: string;
}

const tabId = (key: string) => `cryst-game-type-tab-${key}`;
const PANEL_ID = "cryst-game-type-panel";
const PRESET_LABEL_ID = "cryst-game-type-presets";
const HINT_CLASS =
	"text-pretty text-[length:var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]";

export function GameTypeSheet({
	isCash,
	mixGames,
	onEditComposition,
	onOpenChange,
	onPickMix,
	onPickVariant,
	open,
	variant,
}: GameTypeSheetProps) {
	const sheet = useGameTypeSheet({ mixGames, open, variant });

	return (
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
			title="Select game type"
		>
			<div aria-labelledby={tabId(sheet.mode)} id={PANEL_ID} role="tabpanel">
				{sheet.mode === "single" ? (
					<VariantPickList isPicked={sheet.isPicked} onPick={onPickVariant} />
				) : (
					<div className="flex flex-col gap-3">
						<div className="flex flex-col gap-1.5">
							<span
								className="font-medium text-[length:var(--text-xs)] text-muted-foreground uppercase tracking-[var(--tracking-caps)]"
								id={PRESET_LABEL_ID}
							>
								Preset
							</span>
							<RadioCardGroup
								aria-labelledby={PRESET_LABEL_ID}
								onValueChange={onPickMix}
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
								<RadioCard
									description={sheet.customDescription}
									icon={IconAdjustmentsHorizontal}
									title="Custom mix"
									value={MIX_VARIANT}
								/>
							</RadioCardGroup>
						</div>
						{isCash ? (
							<>
								<button
									className={crystButton({ variant: "outline" })}
									disabled={!sheet.isMix}
									onClick={onEditComposition}
									type="button"
								>
									<IconAdjustments aria-hidden size={16} />
									Edit groups and stakes
								</button>
								<p className={HINT_CLASS}>
									A mix needs at least two games. Stakes are set per group, so
									limit and big-bet rounds keep their own bet sizes.
								</p>
							</>
						) : (
							<p className={HINT_CLASS}>
								Games and stakes for each level are set in the Blinds tab.
							</p>
						)}
					</div>
				)}
			</div>
		</CrystSheet>
	);
}
