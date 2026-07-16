import { variantDisplayLabel } from "@sapphire2/db/constants/game-variants";
import { IconDotsVertical } from "@tabler/icons-react";
import type { RingGame } from "@/features/rooms/hooks/use-ring-games";
import { formatRingGameBlinds } from "@/features/rooms/utils/game-format";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { createGroupFormatter } from "@/utils/format-number";
import { getTableSizeClassName } from "@/utils/table-size-colors";

export interface CurrencyOption {
	id: string;
	name: string;
	unit?: string | null;
}

function formatBuyInLine(
	game: RingGame,
	currencyUnit: string | null | undefined
): string {
	if (game.minBuyIn == null && game.maxBuyIn == null) {
		return "";
	}
	const fmt = createGroupFormatter([game.minBuyIn, game.maxBuyIn]);
	const min = game.minBuyIn == null ? "—" : fmt(game.minBuyIn);
	const max = game.maxBuyIn == null ? "—" : fmt(game.maxBuyIn);
	const unit = currencyUnit ? ` ${currencyUnit}` : "";
	return `Buy-in ${min}–${max}${unit}`;
}

interface RingGameRowProps {
	currencies: CurrencyOption[];
	game: RingGame;
	onOpenActions: (game: RingGame) => void;
}

export function RingGameRow({
	game,
	currencies,
	onOpenActions,
}: RingGameRowProps) {
	const currency = currencies.find((c) => c.id === game.currencyId);
	const blindLine = formatRingGameBlinds(game, currency?.unit);
	const buyInLine = formatBuyInLine(game, currency?.unit);
	const meta = [blindLine, buyInLine].filter(Boolean).join(" · ");
	const isArchived = game.archivedAt != null;

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground",
				isArchived && "opacity-60"
			)}
		>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="truncate font-medium text-sm">{game.name}</span>
					{/* Variants freeze full display labels ("8-Game", "NL Hold'em") —
					    render as-is; uppercasing would mangle them. */}
					<Badge variant="secondary">{variantDisplayLabel(game.variant)}</Badge>
					{game.tableSize == null ? null : (
						<Badge className={getTableSizeClassName(game.tableSize)}>
							{game.tableSize}-max
						</Badge>
					)}
					{isArchived ? <Badge variant="outline">Archived</Badge> : null}
				</div>
				{meta ? (
					<p className="mt-0.5 truncate text-muted-foreground text-xs">
						{meta}
					</p>
				) : null}
			</div>
			<Button
				aria-label={`Actions for ${game.name}`}
				onClick={() => onOpenActions(game)}
				size="icon-sm"
				variant="ghost"
			>
				<IconDotsVertical className="size-4" />
			</Button>
		</div>
	);
}
