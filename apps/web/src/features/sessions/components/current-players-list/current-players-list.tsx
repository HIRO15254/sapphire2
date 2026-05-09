import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { useCurrentPlayersList } from "./use-current-players-list";

interface CurrentPlayersListProps {
	sessionId: string;
}

export function CurrentPlayersList({ sessionId }: CurrentPlayersListProps) {
	const { currentPlayers, isLoading } = useCurrentPlayersList({ sessionId });

	if (isLoading) {
		return <p className="text-muted-foreground text-sm">Loading players...</p>;
	}

	if (currentPlayers.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">No players at the table.</p>
		);
	}

	return (
		<ul className="flex flex-col gap-2">
			{currentPlayers.map((player) => (
				<li
					className="flex items-center gap-2"
					key={player.isHero ? "hero" : (player.playerId ?? "unknown")}
				>
					<Avatar className="h-7 w-7">
						<AvatarFallback className="text-xs">
							{player.isHero ? "H" : "P"}
						</AvatarFallback>
					</Avatar>
					<span className="flex-1 text-sm">
						{player.isHero ? "Hero" : (player.playerId ?? "Unknown Player")}
					</span>
					{player.seatPosition != null && (
						<Badge className="text-xs" variant="outline">
							Seat {player.seatPosition}
						</Badge>
					)}
				</li>
			))}
		</ul>
	);
}
