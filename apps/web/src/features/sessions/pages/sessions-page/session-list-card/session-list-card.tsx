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
	formatTournamentPlacement,
	getSessionGameName,
	isLiveSession,
} from "@/features/sessions/utils/session-display";
import { Badge } from "@/shared/components/ui/badge";
import { formatYmdSlash } from "@/utils/format-number";
import { profitLossColorClass } from "@/utils/format-profit-loss";

export interface SessionListCardItem {
	beforeDeadline: boolean | null;
	breakMinutes: number | null;
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
 * v2 list row for a past session. The whole card links to the detail page; a
 * live-recorded session carries a small green bolt over its type icon (trophy =
 * yellow, chip = blue). Subtext stacks two lines — date + played duration, then
 * the venue — each with a leading icon. The result column shows the colored
 * P&L plus a secondary line: EV for cash games that recorded one, placement for
 * tournaments. P&L / EV respect the BB/BI toggle.
 */
export function SessionListCard({ bbBiMode, session }: SessionListCardProps) {
	const isTournament = session.type === "tournament";
	const live = isLiveSession(session);
	const gameName = getSessionGameName(session);
	const visibleTags = session.tags.slice(0, MAX_VISIBLE_TAGS);
	const overflowCount = session.tags.length - visibleTags.length;
	const duration = formatSessionDuration(
		session.startedAt,
		session.endedAt,
		session.breakMinutes
	);
	const placement = formatTournamentPlacement(session);
	const evDisplay = formatSessionEvDisplay(session, bbBiMode);

	return (
		<Link
			className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			params={{ sessionId: session.id }}
			to="/sessions/$sessionId"
		>
			<span className="relative shrink-0 pt-0.5">
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
						className="absolute -right-1 -bottom-1 size-3 text-green-500 dark:text-green-400"
						data-testid="live-indicator"
					/>
				) : null}
			</span>

			<div className="min-w-0 flex-1">
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
				<div className="mt-1 flex flex-col gap-0.5 text-muted-foreground text-xs">
					<div className="flex items-center gap-3">
						<span className="flex items-center gap-0.5">
							<IconCalendar className="shrink-0" size={12} />
							{formatYmdSlash(session.sessionDate)}
						</span>
						{duration ? (
							<span className="flex items-center gap-0.5">
								<IconClock className="shrink-0" size={12} />
								{duration}
							</span>
						) : null}
					</div>
					{session.roomName ? (
						<div className="flex items-center gap-0.5">
							<IconMapPin className="shrink-0" size={12} />
							<span className="truncate">{session.roomName}</span>
						</div>
					) : null}
				</div>
			</div>

			<div className="flex shrink-0 flex-col items-end">
				<span
					className={`font-mono font-semibold text-sm tabular-nums ${profitLossColorClass(
						session.profitLoss ?? 0
					)}`}
				>
					{formatSessionPlDisplay(session, bbBiMode)}
				</span>
				{placement ? (
					<span className="text-[10px] text-muted-foreground">{placement}</span>
				) : null}
				{evDisplay ? (
					<span className="text-[10px] text-muted-foreground">
						EV{" "}
						<span className={profitLossColorClass(session.evProfitLoss ?? 0)}>
							{evDisplay}
						</span>
					</span>
				) : null}
			</div>
			<IconChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
		</Link>
	);
}
