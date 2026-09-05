import {
	IconChevronRight,
	IconScan,
	IconSearch,
	IconUser,
	IconUserOff,
	IconUserPlus,
	IconUserQuestion,
	IconUserStar,
	IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/shared/components/bottom-sheet";
import { Switch } from "@/shared/components/ui/switch";
import type { JoinSeatPlayerOption } from "./use-join-seat-sheet";
import { useJoinSeatSheet } from "./use-join-seat-sheet";

const RESULT_ROW_CLASS =
	"flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-accent";

type ResultRow =
	| { kind: "create" }
	| { kind: "existing"; player: JoinSeatPlayerOption };

export interface JoinSeatSheetProps {
	excludePlayerIds: string[];
	heroAvailable: boolean;
	onOpenChange: (open: boolean) => void;
	onScan: () => void;
	onSeatExisting: (
		seatPosition: number,
		playerId: string,
		playerName: string
	) => void;
	onSeatHero: (seatPosition: number) => void;
	onSeatNew: (
		seatPosition: number,
		values: { memo?: string | null; name: string; tagIds?: string[] }
	) => void;
	onSeatTemporary: (seatPosition: number) => void;
	open: boolean;
	seatPosition: number | null;
}

export function JoinSeatSheet({
	excludePlayerIds,
	heroAvailable,
	onOpenChange,
	onScan,
	onSeatExisting,
	onSeatHero,
	onSeatNew,
	onSeatTemporary,
	open,
	seatPosition,
}: JoinSeatSheetProps) {
	const {
		clearQuery,
		hasQuery,
		matches,
		onCreate,
		onScanClick,
		onSelectExisting,
		onTemporary,
		onToggleHero,
		query,
		setQuery,
		showCreateOption,
		title,
		trimmedQuery,
	} = useJoinSeatSheet({
		excludePlayerIds,
		onOpenChange,
		onScan,
		onSeatExisting,
		onSeatHero,
		onSeatNew,
		onSeatTemporary,
		seatPosition,
	});

	const resultRows: ResultRow[] = [
		...(showCreateOption ? [{ kind: "create" as const }] : []),
		...matches.map(
			(player: JoinSeatPlayerOption): ResultRow => ({
				kind: "existing",
				player,
			})
		),
	];

	return (
		<BottomSheet
			cancelLabel="Cancel"
			onOpenChange={onOpenChange}
			open={open}
			title={title}
		>
			<div className="flex flex-col gap-2.5">
				<button
					className="flex h-[var(--m-control)] w-full items-center gap-2.5 rounded-md border border-border px-3 text-left font-semibold text-[var(--m-text-footnote)] hover:brightness-[1.15]"
					onClick={onScanClick}
					type="button"
				>
					<IconScan className="text-primary" size={17} />
					<span className="flex-1">Register every seat from a photo</span>
					<IconChevronRight className="text-muted-foreground" size={16} />
				</button>

				<div className="flex h-[var(--m-control)] items-center gap-2 rounded-md border border-border bg-input px-2.5">
					<IconSearch className="shrink-0 text-muted-foreground" size={16} />
					<input
						aria-label="Search players"
						className="min-w-0 flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search by name, or type a new one"
						type="text"
						value={query}
					/>
					{hasQuery ? (
						<button
							aria-label="Clear search"
							className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
							onClick={clearQuery}
							type="button"
						>
							<IconX size={13} />
						</button>
					) : null}
				</div>

				<div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
					{resultRows.map((row, index) => {
						const isLast = index === resultRows.length - 1;
						const rowClassName = cn(
							RESULT_ROW_CLASS,
							!isLast && "border-border border-b"
						);
						if (row.kind === "create") {
							return (
								<button
									className={rowClassName}
									key="create"
									onClick={onCreate}
									type="button"
								>
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
										<IconUserPlus className="text-primary" size={16} />
									</span>
									<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
										<span className="truncate font-medium text-[var(--m-text-secondary)] leading-[1.3]">
											{trimmedQuery}
										</span>
										<span className="truncate text-[var(--m-text-caption)] text-muted-foreground leading-[1.35]">
											New player
										</span>
									</span>
								</button>
							);
						}
						return (
							<button
								className={rowClassName}
								key={row.player.id}
								onClick={() => onSelectExisting(row.player)}
								type="button"
							>
								<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
									<IconUser className="text-muted-foreground" size={16} />
								</span>
								<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
									<span className="truncate font-medium text-[var(--m-text-secondary)] leading-[1.3]">
										{row.player.name}
									</span>
									{row.player.tags.length > 0 ? (
										<span className="truncate text-[var(--m-text-caption)] text-muted-foreground leading-[1.35]">
											{row.player.tags.map((tag) => tag.name).join(" · ")}
										</span>
									) : null}
								</span>
							</button>
						);
					})}
					{resultRows.length === 0 ? (
						<div className="flex flex-col items-center gap-1 px-4 py-5 text-muted-foreground">
							<IconUserOff size={18} />
							<span className="text-[var(--m-text-footnote)]">
								No player matches
							</span>
						</div>
					) : null}
				</div>

				{heroAvailable ? (
					<div className="flex min-h-[var(--m-control)] items-center justify-between gap-2 rounded-md border border-border px-3">
						<span className="flex items-center gap-1.5 text-[var(--m-text-footnote)]">
							<IconUserStar className="text-primary" size={16} />
							This is my seat
						</span>
						<Switch
							aria-label="This is my seat"
							checked={false}
							onCheckedChange={onToggleHero}
						/>
					</div>
				) : null}

				<button
					className="flex min-h-[var(--m-control)] w-full items-center gap-2.5 rounded-md border border-border px-3 text-left text-[var(--m-text-footnote)]"
					onClick={onTemporary}
					type="button"
				>
					<IconUserQuestion className="text-muted-foreground" size={17} />
					<span className="flex-1">Seat a temporary player</span>
				</button>

				<p className="text-pretty text-[11px] text-muted-foreground">
					Pick a known player, or type a name to register a temporary player
					(can be merged later).
				</p>
			</div>
		</BottomSheet>
	);
}
