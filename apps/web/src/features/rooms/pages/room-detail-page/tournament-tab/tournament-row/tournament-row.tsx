import { variantDisplayLabel } from "@sapphire2/db/constants/game-variants";
import { IconDotsVertical } from "@tabler/icons-react";
import type { Tournament } from "@/features/rooms/hooks/use-tournaments";
import { formatTournamentBuyIn } from "@/features/rooms/utils/game-format";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { getTableSizeClassName } from "@/utils/table-size-colors";

export interface CurrencyOption {
	id: string;
	name: string;
	unit?: string | null;
}

interface TournamentRowProps {
	currencies: CurrencyOption[];
	onOpenActions: (tournament: Tournament) => void;
	tournament: Tournament;
}

export function TournamentRow({
	tournament,
	currencies,
	onOpenActions,
}: TournamentRowProps) {
	const currency = currencies.find((c) => c.id === tournament.currencyId);
	const buyIn = formatTournamentBuyIn(tournament, currency?.unit);
	const isArchived = tournament.archivedAt != null;
	const meta = [
		buyIn,
		tournament.blindLevelCount > 0
			? `${tournament.blindLevelCount} levels`
			: "",
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground",
				isArchived && "opacity-60"
			)}
		>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="truncate font-medium text-sm">
						{tournament.name}
					</span>
					{/* Variants freeze full display labels ("8-Game", "NL Hold'em") —
					    render as-is; uppercasing would mangle them. */}
					<Badge variant="secondary">
						{variantDisplayLabel(tournament.variant)}
					</Badge>
					{tournament.tableSize == null ? null : (
						<Badge className={getTableSizeClassName(tournament.tableSize)}>
							{tournament.tableSize}-max
						</Badge>
					)}
					{tournament.tags.map((tag) => (
						<Badge key={tag.id} variant="outline">
							{tag.name}
						</Badge>
					))}
					{isArchived ? <Badge variant="outline">Archived</Badge> : null}
				</div>
				{meta ? (
					<p className="mt-0.5 truncate text-muted-foreground text-xs">
						{meta}
					</p>
				) : null}
			</div>
			<Button
				aria-label={`Actions for ${tournament.name}`}
				onClick={() => onOpenActions(tournament)}
				size="icon-sm"
				variant="ghost"
			>
				<IconDotsVertical className="size-4" />
			</Button>
		</div>
	);
}
