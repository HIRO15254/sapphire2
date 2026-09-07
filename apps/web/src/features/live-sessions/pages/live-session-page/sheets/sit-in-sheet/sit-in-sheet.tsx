import { IconUserStar } from "@tabler/icons-react";
import { Switch } from "@/shared/components/ui/switch";
import { PlayerPicker } from "../../player-picker";
import { CrystFormSheet } from "../cryst-form-sheet";
import { useSitInSheet } from "./use-sit-in-sheet";

const FORM_ID = "cryst-sit-in-form";
const HERO_SWITCH_ID = "cryst-sit-in-hero-seat";

interface SitInSheetProps {
	excludePlayerIds: readonly string[];
	heroSeatPosition: number | null;
	onOpenChange: (open: boolean) => void;
	onSeatExisting: (playerId: string, playerName: string) => void;
	onSeatHero: () => void;
	onSeatNew: (name: string) => void;
	onSeatTemporary: () => void;
	open: boolean;
	seatPosition: number;
}

export function SitInSheet({
	excludePlayerIds,
	heroSeatPosition,
	onOpenChange,
	onSeatExisting,
	onSeatHero,
	onSeatNew,
	onSeatTemporary,
	open,
	seatPosition,
}: SitInSheetProps) {
	const sheet = useSitInSheet({
		excludePlayerIds,
		heroSeatPosition,
		onSeatExisting,
		onSeatHero,
		onSeatNew,
		onSeatTemporary,
		open,
		seatPosition,
	});

	const canSubmit = sheet.isHeroSeat || sheet.pickedKey !== null;

	return (
		<CrystFormSheet
			className="h-auto max-h-[calc(100svh-2rem)]"
			formId={FORM_ID}
			isSaveDisabled={!canSubmit}
			onOpenChange={onOpenChange}
			open={open}
			title={`Sit in at ${sheet.seatLabel}`}
		>
			<form
				className="flex flex-col gap-2.5"
				id={FORM_ID}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					if (canSubmit) {
						sheet.onSubmit();
					}
				}}
			>
				<PlayerPicker
					candidates={sheet.candidates}
					emptyLabel={
						sheet.isLoading ? "Loading players..." : "No player matches"
					}
					isDisabled={sheet.isHeroSeat}
					onPick={sheet.onPick}
					onQueryChange={sheet.onQueryChange}
					pickedKey={sheet.pickedKey}
					query={sheet.query}
					searchLabel="Search by name, or type a new one"
				/>

				<div className="flex min-h-[var(--m-control)] items-center justify-between gap-2 rounded-md border border-border px-3">
					<label
						className="inline-flex items-center gap-1.5 text-[length:var(--m-text-footnote)]"
						htmlFor={HERO_SWITCH_ID}
					>
						<IconUserStar className="text-primary" size={16} />
						This is my seat
					</label>
					<Switch
						checked={sheet.isHeroSeat}
						id={HERO_SWITCH_ID}
						onCheckedChange={sheet.onToggleHeroSeat}
					/>
				</div>
			</form>
		</CrystFormSheet>
	);
}
