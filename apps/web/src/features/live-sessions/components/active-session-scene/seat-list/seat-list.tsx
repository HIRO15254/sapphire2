import { IconCamera, IconChevronDown, IconLogout } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type {
	SeatEntry,
	SeatPlayer,
} from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";
import { memoExcerpt } from "@/features/live-sessions/utils/memo-excerpt";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { EmptySeatEditor } from "./empty-seat-editor";
import { OccupiedSeatEditor } from "./occupied-seat-editor";
import { useSeatList } from "./use-seat-list";

interface SeatListProps {
	excludePlayerIds: string[];
	onRemovePlayer: (playerId: string) => void;
	onScanPlayers: () => void;
	onSeatExisting: (
		seatPosition: number,
		playerId: string,
		playerName: string
	) => void;
	onSeatNew: (
		seatPosition: number,
		values: { name: string; tagIds?: string[] }
	) => void;
	onSeatTemporary: (seatPosition: number) => void;
	seats: SeatEntry[];
	unseatedPlayers: SeatPlayer[];
}

function SeatRowShell({
	children,
	isExpanded,
	label,
	onToggle,
	summary,
	trailingAction,
}: {
	children?: ReactNode;
	isExpanded: boolean;
	label: string;
	onToggle?: () => void;
	summary: ReactNode;
	trailingAction?: ReactNode;
}) {
	return (
		<li className="border-border border-b last:border-b-0">
			<div className="flex items-center">
				{onToggle ? (
					<button
						aria-expanded={isExpanded}
						className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
						onClick={onToggle}
						type="button"
					>
						<span className="w-12 shrink-0 text-muted-foreground text-xs">
							{label}
						</span>
						<span className="min-w-0 flex-1">{summary}</span>
						<IconChevronDown
							className={cn(
								"shrink-0 text-muted-foreground transition-transform",
								isExpanded && "rotate-180"
							)}
							size={16}
						/>
					</button>
				) : (
					<div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left">
						<span className="w-12 shrink-0 text-muted-foreground text-xs">
							{label}
						</span>
						<span className="min-w-0 flex-1">{summary}</span>
					</div>
				)}
				{trailingAction ? (
					<span className="shrink-0 pr-2">{trailingAction}</span>
				) : null}
			</div>
			{isExpanded ? <div className="px-4 pt-1 pb-3">{children}</div> : null}
		</li>
	);
}

function PlayerSummary({ player }: { player: SeatPlayer }) {
	const excerpt = memoExcerpt(player.memo);

	return (
		<span className="flex items-center gap-2">
			<Avatar size="sm">
				<AvatarFallback>{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
			</Avatar>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-1.5">
					<span className="truncate font-medium text-sm">{player.name}</span>
					{player.isTemporary ? (
						<Badge
							className="border-warning/40 bg-warning/10 text-[10px] text-warning"
							variant="outline"
						>
							Temp
						</Badge>
					) : null}
					{player.tags.map((tag) => (
						<Badge
							key={tag.id}
							style={{ borderColor: tag.color, color: tag.color }}
							variant="outline"
						>
							{tag.name}
						</Badge>
					))}
				</span>
				{excerpt ? (
					<span className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
						{excerpt}
					</span>
				) : null}
			</span>
		</span>
	);
}

/**
 * Speed-first all-seats list (SA2-59): every seat from the game definition is a
 * row. Notes and tags are readable with zero taps (memo excerpt on the row),
 * leaving is one tap (row-level unseat button), and seating / editing happens
 * inline by expanding the row — never through a modal.
 */
export function SeatList({
	excludePlayerIds,
	onRemovePlayer,
	onScanPlayers,
	onSeatExisting,
	onSeatNew,
	onSeatTemporary,
	seats,
	unseatedPlayers,
}: SeatListProps) {
	const { collapse, expandedKey, onToggle } = useSeatList();

	const unseatButton = (player: SeatPlayer) => (
		<Button
			aria-label={`Unseat ${player.name}`}
			className="text-muted-foreground hover:text-destructive"
			onClick={() => {
				onRemovePlayer(player.playerId);
				collapse();
			}}
			size="icon-sm"
			type="button"
			variant="ghost"
		>
			<IconLogout size={16} />
		</Button>
	);

	return (
		<section className="rounded-lg border border-border bg-card text-card-foreground">
			<div className="flex items-center justify-between border-border border-b px-4 py-2">
				<h2 className="t-h4">Players</h2>
				<Button
					aria-label="Seat from screenshot"
					onClick={onScanPlayers}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<IconCamera size={18} />
				</Button>
			</div>
			<ul className="flex flex-col">
				{seats.map((seat) => {
					const key = `seat-${seat.seatPosition}`;
					const label = `Seat ${seat.seatPosition + 1}`;
					if (seat.isHero) {
						return (
							<SeatRowShell
								isExpanded={false}
								key={key}
								label={label}
								summary={
									<span className="font-medium text-primary text-sm">You</span>
								}
							/>
						);
					}
					const isExpanded = expandedKey === key;
					return (
						<SeatRowShell
							isExpanded={isExpanded}
							key={key}
							label={label}
							onToggle={() => onToggle(key)}
							summary={
								seat.player ? (
									<PlayerSummary player={seat.player} />
								) : (
									<span className="text-muted-foreground text-sm">Empty</span>
								)
							}
							trailingAction={seat.player ? unseatButton(seat.player) : null}
						>
							{seat.player ? (
								<OccupiedSeatEditor playerId={seat.player.playerId} />
							) : (
								<EmptySeatEditor
									excludePlayerIds={excludePlayerIds}
									onAddExisting={(playerId, playerName) => {
										onSeatExisting(seat.seatPosition, playerId, playerName);
										collapse();
									}}
									onAddNew={(values) => {
										onSeatNew(seat.seatPosition, values);
										collapse();
									}}
									onAddTemporary={() => {
										onSeatTemporary(seat.seatPosition);
										collapse();
									}}
								/>
							)}
						</SeatRowShell>
					);
				})}

				{unseatedPlayers.map((player) => {
					const key = `unseated-${player.id}`;
					const isExpanded = expandedKey === key;
					return (
						<SeatRowShell
							isExpanded={isExpanded}
							key={key}
							label="Unseated"
							onToggle={() => onToggle(key)}
							summary={<PlayerSummary player={player} />}
							trailingAction={unseatButton(player)}
						>
							<OccupiedSeatEditor playerId={player.playerId} />
						</SeatRowShell>
					);
				})}
			</ul>
		</section>
	);
}
