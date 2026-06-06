import {
	IconBolt,
	IconChevronRight,
	IconPokerChip,
	IconTrophy,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
	formatSessionPlDisplay,
	getSessionGameName,
	isLiveSession,
} from "@/features/sessions/utils/session-display";
import { Badge } from "@/shared/components/ui/badge";
import { formatYmdSlash } from "@/utils/format-number";
import { profitLossColorClass } from "@/utils/format-profit-loss";

export interface SessionListCardItem {
	chipPurchaseCost: number;
	currencyUnit: string | null;
	entryFee: number | null;
	id: string;
	profitLoss: number | null;
	ringGameBlind2: number | null;
	ringGameName: string | null;
	roomName: string | null;
	sessionDate: string;
	source: string;
	tags: Array<{ id: string; name: string }>;
	tournamentBuyIn: number | null;
	tournamentName: string | null;
	type: string;
}

interface SessionListCardProps {
	/** When on, P&L renders in big blinds (cash) / buy-ins (tournament). */
	bbBiMode: boolean;
	session: SessionListCardItem;
}

/** Tags shown inline before collapsing the remainder into a `+N` badge. */
const MAX_VISIBLE_TAGS = 2;

/**
 * v2 list row for a past session. The whole card is a link to the detail page;
 * a live-recorded session carries a small bolt over its type icon. The type
 * icon keeps its pre-v2 accent (trophy = yellow, chip = blue). P&L is pinned
 * right, colored by sign, and respects the BB/BI toggle.
 */
export function SessionListCard({ bbBiMode, session }: SessionListCardProps) {
	const isTournament = session.type === "tournament";
	const live = isLiveSession(session);
	const gameName = getSessionGameName(session);
	const visibleTags = session.tags.slice(0, MAX_VISIBLE_TAGS);
	const overflowCount = session.tags.length - visibleTags.length;

	return (
		<Link
			className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			params={{ sessionId: session.id }}
			to="/sessions/$sessionId"
		>
			<span className="relative shrink-0">
				{isTournament ? (
					<IconTrophy
						aria-hidden
						className="size-5 text-yellow-500 dark:text-yellow-400"
					/>
				) : (
					<IconPokerChip
						aria-hidden
						className="size-5 text-blue-500 dark:text-blue-400"
					/>
				)}
				{live ? (
					<IconBolt
						className="absolute -right-1 -bottom-1 size-3 text-success"
						data-testid="live-indicator"
					/>
				) : null}
			</span>

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="min-w-0 truncate font-medium text-foreground text-sm">
						{gameName}
					</span>
					{visibleTags.map((tag) => (
						<Badge className="shrink-0" key={tag.id} variant="secondary">
							{tag.name}
						</Badge>
					))}
					{overflowCount > 0 ? (
						<Badge className="shrink-0" variant="secondary">
							+{overflowCount}
						</Badge>
					) : null}
				</div>
				<span className="truncate text-muted-foreground text-xs">
					{formatYmdSlash(session.sessionDate)}
					{session.roomName ? ` · ${session.roomName}` : ""}
				</span>
			</div>

			<span
				className={`shrink-0 font-mono font-semibold text-sm tabular-nums ${profitLossColorClass(
					session.profitLoss ?? 0
				)}`}
			>
				{formatSessionPlDisplay(session, bbBiMode)}
			</span>
			<IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
		</Link>
	);
}
