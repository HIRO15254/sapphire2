import { variantShortLabel } from "@sapphire2/db/constants/game-variants";
import {
	IconBolt,
	IconCalendar,
	IconChevronRight,
	IconClock,
	IconMapPin,
	IconPokerChip,
	IconTrophy,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
	formatSessionDuration,
	formatSessionEvDisplay,
	formatSessionPlDisplay,
	formatTournamentResult,
	getSessionGameName,
	isLiveSession,
} from "@/features/sessions/utils/session-display";
import { Badge } from "@/shared/components/ui/badge";
import { formatYmdSlash } from "@/utils/format-number";
import { profitLossColorClass } from "@/utils/format-profit-loss";

export interface SessionListCardItem {
	breakMinutes: number | null;
	/** Preset key ("nlh") or verbatim custom label, set only on cash sessions. */
	cashVariant: string | null;
	chipPurchaseCost: number;
	currencyUnit: string | null;
	endedAt: string | null;
	entryFee: number | null;
	evProfitLoss: number | null;
	id: string;
	placement: number | null;
	profitLoss: number | null;
	ringGameBlind2: number | null;
	ringGameName: string | null;
	roomName: string | null;
	sessionDate: string;
	source: string;
	startedAt: string | null;
	tags: Array<{ id: string; name: string }>;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
	tournamentName: string | null;
	/** Preset key ("nlh") or verbatim custom label, set only on tournament sessions. */
	tournamentVariant: string | null;
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
 * a live-recorded session carries a small green bolt over its type icon. The
 * type icon keeps its pre-v2 accent (trophy = yellow, chip = blue). The subtext
 * stacks two rows — date + played duration, then the room — each icon-led. The
 * result column is right-pinned: the P&L (colored by sign, BB/BI-aware) on top,
 * and a secondary line below — placement / field for tournaments, EV for cash
 * games that logged one.
 */
export function SessionListCard({ bbBiMode, session }: SessionListCardProps) {
	const isTournament = session.type === "tournament";
	const live = isLiveSession(session);
	const gameName = getSessionGameName(session);
	const variant = session.cashVariant ?? session.tournamentVariant;
	const visibleTags = session.tags.slice(0, MAX_VISIBLE_TAGS);
	const overflowCount = session.tags.length - visibleTags.length;
	const duration = formatSessionDuration(
		session.startedAt,
		session.endedAt,
		session.breakMinutes
	);
	const tournamentResult = formatTournamentResult(session);
	const evDisplay = formatSessionEvDisplay(session, bbBiMode);

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

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="min-w-0 truncate font-medium text-foreground text-sm">
						{gameName}
					</span>
					{variant ? (
						<Badge className="shrink-0" variant="secondary">
							{variantShortLabel(variant)}
						</Badge>
					) : null}
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

				<div className="flex items-center gap-3 text-muted-foreground text-xs">
					<span className="inline-flex items-center gap-1">
						<IconCalendar aria-hidden className="size-3.5 shrink-0" />
						{formatYmdSlash(session.sessionDate)}
					</span>
					{duration ? (
						<span
							className="inline-flex items-center gap-1"
							data-testid="session-duration"
						>
							<IconClock aria-hidden className="size-3.5 shrink-0" />
							{duration}
						</span>
					) : null}
				</div>

				{session.roomName ? (
					<div className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
						<IconMapPin aria-hidden className="size-3.5 shrink-0" />
						<span className="truncate">{session.roomName}</span>
					</div>
				) : null}
			</div>

			<div className="flex shrink-0 flex-col items-end gap-0.5">
				<span
					className={`font-mono font-semibold text-sm tabular-nums ${profitLossColorClass(
						session.profitLoss ?? 0
					)}`}
				>
					{formatSessionPlDisplay(session, bbBiMode)}
				</span>
				{tournamentResult ? (
					<span
						className="font-mono text-muted-foreground text-xs tabular-nums"
						data-testid="tournament-result"
					>
						{tournamentResult}
					</span>
				) : null}
				{evDisplay ? (
					<span
						className={`font-mono text-xs tabular-nums ${profitLossColorClass(
							Math.round(session.evProfitLoss ?? 0)
						)}`}
						data-testid="ev-result"
					>
						EV {evDisplay}
					</span>
				) : null}
			</div>
			<IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
		</Link>
	);
}
