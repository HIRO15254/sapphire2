import { IconCamera, IconUserPlus } from "@tabler/icons-react";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

export interface PlayerListItem {
	/** session_table_player row id. */
	id: string;
	/** True while the row only exists as an optimistic cache entry. */
	isLoading: boolean;
	isTemporary: boolean;
	name: string;
	playerId: string;
	seatPosition: number | null;
	tags: { color: string; id: string; name: string }[];
}

interface PlayerListProps {
	onAddPlayer: () => void;
	onPlayerTap: (playerId: string) => void;
	onScanPlayers: () => void;
	players: PlayerListItem[];
}

/**
 * Lightweight seated-player list for the active-session page — replaces the
 * old poker-table visualization. Rows open the player detail sheet (memo /
 * tags / leave); seating happens through the header actions.
 */
export function PlayerList({
	onAddPlayer,
	onPlayerTap,
	onScanPlayers,
	players,
}: PlayerListProps) {
	return (
		<section className="rounded-lg border border-border bg-card text-card-foreground">
			<div className="flex items-center justify-between border-border border-b px-4 py-2">
				<h2 className="t-h4">Players</h2>
				<div className="flex items-center gap-1">
					<Button
						aria-label="Seat from screenshot"
						onClick={onScanPlayers}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<IconCamera size={18} />
					</Button>
					<Button
						aria-label="Add player"
						onClick={onAddPlayer}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<IconUserPlus size={18} />
					</Button>
				</div>
			</div>
			{players.length === 0 ? (
				<p className="px-4 py-6 text-center text-muted-foreground text-sm">
					No players seated yet.
				</p>
			) : (
				<ul className="flex flex-col">
					{players.map((item) => (
						<li
							className="border-border border-b last:border-b-0"
							key={item.id}
						>
							<button
								className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
								disabled={item.isLoading}
								onClick={() => onPlayerTap(item.playerId)}
								type="button"
							>
								<Avatar size="sm">
									<AvatarFallback>
										{item.name.slice(0, 1).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span className="min-w-0 flex-1">
									<span className="flex items-center gap-1.5">
										<span className="truncate font-medium text-sm">
											{item.name}
										</span>
										{item.isTemporary ? (
											<Badge
												className="border-warning/40 bg-warning/10 text-[10px] text-warning"
												variant="outline"
											>
												Temp
											</Badge>
										) : null}
									</span>
									{item.tags.length > 0 ? (
										<span className="mt-0.5 flex flex-wrap items-center gap-1">
											{item.tags.map((tag) => (
												<Badge
													key={tag.id}
													style={{
														borderColor: tag.color,
														color: tag.color,
													}}
													variant="outline"
												>
													{tag.name}
												</Badge>
											))}
										</span>
									) : null}
								</span>
								{item.seatPosition === null ? null : (
									<Badge variant="secondary">
										Seat {item.seatPosition + 1}
									</Badge>
								)}
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
