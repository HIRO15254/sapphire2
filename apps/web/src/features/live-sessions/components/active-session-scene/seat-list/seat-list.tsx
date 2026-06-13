import { IconCamera, IconChevronDown } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type {
	SeatEntry,
	SeatPlayer,
} from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { EmptySeatEditor } from "./empty-seat-editor";
import { OccupiedSeatEditor } from "./occupied-seat-editor";
import { useSeatList } from "./use-seat-list";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface SeatListProps {
	availableTags: TagWithColor[];
	excludePlayerIds: string[];
	onCreateTag: (name: string) => Promise<TagWithColor>;
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
}: {
	children?: ReactNode;
	isExpanded: boolean;
	label: string;
	onToggle?: () => void;
	summary: ReactNode;
}) {
	return (
		<li className="border-border border-b last:border-b-0">
			{onToggle ? (
				<button
					aria-expanded={isExpanded}
					className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
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
				<div className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
					<span className="w-12 shrink-0 text-muted-foreground text-xs">
						{label}
					</span>
					<span className="min-w-0 flex-1">{summary}</span>
				</div>
			)}
			{isExpanded ? <div className="px-4 pt-1 pb-3">{children}</div> : null}
		</li>
	);
}

function PlayerSummary({ player }: { player: SeatPlayer }) {
	return (
		<span className="flex items-center gap-2">
			<Avatar size="sm">
				<AvatarFallback>{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
			</Avatar>
			<span className="min-w-0">
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
				</span>
				{player.tags.length > 0 ? (
					<span className="mt-0.5 flex flex-wrap gap-1">
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
				) : null}
			</span>
		</span>
	);
}

/**
 * All-seats player list for the active-session page. Renders one row per seat
 * defined by the game (empty seats included); tapping a row expands it inline
 * to seat a player or edit an occupied player's notes / tags — no modal. Hero
 * seat shows "You" and players without a valid seat fall into an "Unseated"
 * group below.
 */
export function SeatList({
	availableTags,
	excludePlayerIds,
	onCreateTag,
	onRemovePlayer,
	onScanPlayers,
	onSeatExisting,
	onSeatNew,
	onSeatTemporary,
	seats,
	unseatedPlayers,
}: SeatListProps) {
	const { collapse, expandedKey, onToggle } = useSeatList();

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
						>
							{seat.player ? (
								<OccupiedSeatEditor
									onRemove={() => {
										if (seat.player) {
											onRemovePlayer(seat.player.playerId);
										}
										collapse();
									}}
									onSaved={collapse}
									playerId={seat.player.playerId}
								/>
							) : (
								<EmptySeatEditor
									availableTags={availableTags}
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
									onCreateTag={onCreateTag}
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
						>
							<OccupiedSeatEditor
								onRemove={() => {
									onRemovePlayer(player.playerId);
									collapse();
								}}
								onSaved={collapse}
								playerId={player.playerId}
							/>
						</SeatRowShell>
					);
				})}
			</ul>
		</section>
	);
}
