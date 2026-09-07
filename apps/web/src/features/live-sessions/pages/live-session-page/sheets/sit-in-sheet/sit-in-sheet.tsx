import {
	IconCheck,
	IconChevronRight,
	IconScan,
	IconSearch,
	IconUser,
	IconUserOff,
	IconUserPlus,
	IconUserStar,
	IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/shared/components/ui/switch";
import { CrystFormSheet } from "../cryst-form-sheet";
import type { SitInCandidate } from "./use-sit-in-sheet";
import { useSitInSheet } from "./use-sit-in-sheet";

const FORM_ID = "cryst-sit-in-form";
const HERO_SWITCH_ID = "cryst-sit-in-hero-seat";

interface SitInSheetProps {
	excludePlayerIds: readonly string[];
	heroSeatPosition: number | null;
	onOpenChange: (open: boolean) => void;
	onOpenScan: () => void;
	onSeatExisting: (playerId: string, playerName: string) => void;
	onSeatHero: () => void;
	onSeatNew: (name: string) => void;
	open: boolean;
	seatPosition: number;
}

function CandidateRow({
	candidate,
	isPicked,
	onPick,
}: {
	candidate: SitInCandidate;
	isPicked: boolean;
	onPick: (candidate: SitInCandidate) => void;
}) {
	const Icon = candidate.id === null ? IconUserPlus : IconUser;
	return (
		<button
			aria-pressed={isPicked}
			className={cn(
				"flex min-h-14 w-full items-center gap-3 border-border border-b px-3.5 py-2 text-left last:border-b-0",
				isPicked && "bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]"
			)}
			onClick={() => onPick(candidate)}
			type="button"
		>
			<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
				<Icon
					className={
						candidate.id === null ? "text-primary" : "text-muted-foreground"
					}
					size={16}
				/>
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
				<span className="truncate font-medium text-[length:var(--m-text-secondary)] leading-[1.3]">
					{candidate.name}
				</span>
				<span className="truncate text-[length:var(--m-text-caption)] text-muted-foreground leading-[1.35]">
					{candidate.meta}
				</span>
			</span>
			{isPicked ? (
				<IconCheck className="shrink-0 text-primary" size={16} />
			) : null}
		</button>
	);
}

export function SitInSheet({
	excludePlayerIds,
	heroSeatPosition,
	onOpenChange,
	onOpenScan,
	onSeatExisting,
	onSeatHero,
	onSeatNew,
	open,
	seatPosition,
}: SitInSheetProps) {
	const sheet = useSitInSheet({
		excludePlayerIds,
		heroSeatPosition,
		onSeatExisting,
		onSeatHero,
		onSeatNew,
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
				<button
					className="flex min-h-[var(--m-control)] w-full items-center gap-2.5 rounded-md border border-border bg-transparent px-3 text-left font-semibold text-[length:var(--m-text-footnote)]"
					onClick={onOpenScan}
					type="button"
				>
					<IconScan className="text-primary" size={17} />
					<span className="flex-1">Register every seat from a photo</span>
					<IconChevronRight className="text-muted-foreground" size={16} />
				</button>

				<div
					className={cn(
						"flex flex-col gap-2.5",
						sheet.isHeroSeat && "pointer-events-none opacity-50"
					)}
				>
					<div className="flex h-[var(--m-control)] items-center gap-2 rounded-md border border-border bg-input px-2.5">
						<IconSearch className="shrink-0 text-muted-foreground" size={16} />
						<input
							aria-label="Search by name, or type a new one"
							className="min-w-0 flex-1 border-none bg-transparent text-[length:var(--m-text-secondary)] outline-none"
							onChange={(e) => sheet.onQueryChange(e.target.value)}
							type="text"
							value={sheet.query}
						/>
						{sheet.query === "" ? null : (
							<button
								aria-label="Clear search"
								className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
								onClick={() => sheet.onQueryChange("")}
								type="button"
							>
								<IconX size={13} />
							</button>
						)}
					</div>

					<div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
						{sheet.candidates.length === 0 ? (
							<div className="flex flex-col items-center gap-1 px-4 py-5 text-muted-foreground">
								<IconUserOff size={18} />
								<span className="text-[length:var(--m-text-footnote)]">
									{sheet.isLoading ? "Loading players..." : "No player matches"}
								</span>
							</div>
						) : (
							sheet.candidates.map((candidate) => (
								<CandidateRow
									candidate={candidate}
									isPicked={sheet.pickedKey === candidate.key}
									key={candidate.key}
									onPick={sheet.onPick}
								/>
							))
						)}
					</div>
				</div>

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
