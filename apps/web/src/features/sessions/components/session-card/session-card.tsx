import {
	IconArrowRight,
	IconBolt,
	IconCalendar,
	IconClock,
	IconList,
	IconMapPin,
	IconPlayerPlay,
	IconPokerChip,
	IconShare2,
	IconTrophy,
} from "@tabler/icons-react";
import { EntityListItem } from "@/shared/components/management/entity-list-item";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatCompactNumber, formatYmdSlash } from "@/utils/format-number";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import { useSessionCard } from "./use-session-card";

interface SessionCardProps {
	bbBiMode?: boolean;
	onDelete: (id: string) => void;
	onEdit: (session: SessionCardProps["session"]) => void;
	onReopen?: (sessionId: string) => void;
	onViewEvents?: (input: {
		sessionId: string;
		sessionType: "cash-game" | "tournament";
	}) => void;
	session: {
		beforeDeadline: boolean | null;
		bountyPrizes: number | null;
		breakMinutes: number | null;
		cashBuyIn: number | null;
		cashOut: number | null;
		cashRingGameId: string | null;
		cashRuleName: string | null;
		createdAt: string | Date;
		currencyId: string | null;
		currencyName: string | null;
		currencyUnit: string | null;
		endedAt: string | Date | null;
		evCashOut: number | null;
		id: string;
		kind: string;
		memo: string | null;
		placement: number | null;
		prizeMoney: number | null;
		ringGameName: string | null;
		sessionDate: string | Date;
		source: string;
		startedAt: string | Date | null;
		status: string;
		storeId: string | null;
		storeName: string | null;
		tags: Array<{ id: string; name: string }>;
		totalEntries: number | null;
		tournamentBuyIn: number | null;
		tournamentEntryFee: number | null;
		tournamentId: string | null;
		tournamentName: string | null;
		tournamentRuleName: string | null;
	};
}

function getGameName(session: SessionCardProps["session"]): string {
	if (session.kind === "tournament" && session.tournamentName) {
		return session.tournamentName;
	}
	if (session.kind === "cash_game" && session.ringGameName) {
		return session.ringGameName;
	}
	return session.kind === "tournament" ? "Tournament" : "Cash Game";
}

function computeCashProfitLoss(session: SessionCardProps["session"]): number {
	return (session.cashOut ?? 0) - (session.cashBuyIn ?? 0);
}

function computeTournamentProfitLoss(
	session: SessionCardProps["session"]
): number {
	const income = session.prizeMoney ?? 0;
	const cost =
		(session.tournamentBuyIn ?? 0) + (session.tournamentEntryFee ?? 0);
	return income - cost;
}

function computeProfitLoss(session: SessionCardProps["session"]): number {
	if (session.kind === "tournament") {
		return computeTournamentProfitLoss(session);
	}
	return computeCashProfitLoss(session);
}

function formatDuration(
	startedAt: string | Date,
	endedAt: string | Date,
	breakMinutes?: number | null
): string {
	const startMs =
		typeof startedAt === "string"
			? new Date(startedAt).getTime()
			: startedAt.getTime();
	const endMs =
		typeof endedAt === "string"
			? new Date(endedAt).getTime()
			: endedAt.getTime();
	const diffMs = endMs - startMs;
	const breakMs = (breakMinutes ?? 0) * 60 * 1000;
	const hours = (diffMs - breakMs) / (1000 * 60 * 60);
	return `${hours.toFixed(1)}h`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex justify-between gap-2">
			<span className="text-muted-foreground">{label}</span>
			<span className="text-right">{value}</span>
		</div>
	);
}

function CashGameDetails({
	session,
}: {
	session: SessionCardProps["session"];
}) {
	const rows: Array<{ label: string; value: string }> = [];
	if (session.cashBuyIn !== null) {
		rows.push({
			label: "Buy-in",
			value: formatCompactNumber(session.cashBuyIn),
		});
	}
	if (session.cashOut !== null) {
		rows.push({
			label: "Cash-out",
			value: formatCompactNumber(session.cashOut),
		});
	}
	if (session.evCashOut !== null) {
		rows.push({
			label: "EV Cash-out",
			value: formatCompactNumber(session.evCashOut),
		});
	}
	if (session.currencyName) {
		rows.push({ label: "Currency", value: session.currencyName });
	}
	if (session.startedAt && session.endedAt) {
		rows.push({
			label: "Duration",
			value: formatDuration(
				session.startedAt,
				session.endedAt,
				session.breakMinutes
			),
		});
	}
	return (
		<>
			{rows.map((r) => (
				<DetailRow key={r.label} label={r.label} value={r.value} />
			))}
		</>
	);
}

function TournamentDetails({
	session,
}: {
	session: SessionCardProps["session"];
}) {
	const rows: Array<{ label: string; value: string }> = [];
	if (session.tournamentBuyIn !== null) {
		rows.push({
			label: "Buy-in",
			value: formatCompactNumber(session.tournamentBuyIn),
		});
	}
	if (session.tournamentEntryFee !== null && session.tournamentEntryFee > 0) {
		rows.push({
			label: "Entry Fee",
			value: formatCompactNumber(session.tournamentEntryFee),
		});
	}
	if (session.prizeMoney !== null && session.prizeMoney > 0) {
		rows.push({
			label: "Prize",
			value: formatCompactNumber(session.prizeMoney),
		});
	}
	if (session.bountyPrizes !== null && session.bountyPrizes > 0) {
		rows.push({
			label: "Bounty",
			value: formatCompactNumber(session.bountyPrizes),
		});
	}
	if (session.currencyName) {
		rows.push({ label: "Currency", value: session.currencyName });
	}
	if (session.startedAt && session.endedAt) {
		rows.push({
			label: "Duration",
			value: formatDuration(
				session.startedAt,
				session.endedAt,
				session.breakMinutes
			),
		});
	}
	return (
		<>
			{rows.map((r) => (
				<DetailRow key={r.label} label={r.label} value={r.value} />
			))}
		</>
	);
}

function SessionHeader({
	bbBiMode: _bbBiMode,
	session,
}: {
	bbBiMode?: boolean;
	session: SessionCardProps["session"];
}) {
	const profitLoss = computeProfitLoss(session);
	const isTournament = session.kind === "tournament";
	const isLive = session.source === "live";
	const plDisplay = formatProfitLoss(profitLoss, {
		currencyUnit: session.currencyUnit,
	});
	const profitColorClass = profitLossColorClass(profitLoss);
	const gameName = getGameName(session);

	return (
		<>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="relative shrink-0">
						{isTournament ? (
							<IconTrophy
								className="text-yellow-500 dark:text-yellow-400"
								size={16}
							/>
						) : (
							<IconPokerChip
								className="text-blue-500 dark:text-blue-400"
								size={16}
							/>
						)}
						{isLive && (
							<IconBolt
								className="absolute -right-1 -bottom-1 text-green-500 dark:text-green-400"
								size={10}
							/>
						)}
					</span>
					<span className="truncate font-medium text-sm">{gameName}</span>
					{session.tags.map((tag) => (
						<Badge className="shrink-0" key={tag.id} variant="outline">
							{tag.name}
						</Badge>
					))}
				</div>
				<div className="mt-1 flex flex-col text-muted-foreground text-xs">
					<div className="flex items-center gap-3">
						<span className="flex items-center gap-0.5">
							<IconCalendar className="shrink-0" size={12} />
							{formatYmdSlash(
								typeof session.sessionDate === "string"
									? session.sessionDate
									: session.sessionDate.toISOString()
							)}
						</span>
						{session.startedAt && session.endedAt && (
							<span className="flex items-center gap-0.5">
								<IconClock className="shrink-0" size={12} />
								{formatDuration(
									session.startedAt,
									session.endedAt,
									session.breakMinutes
								)}
							</span>
						)}
					</div>
					{session.storeName && (
						<div className="flex items-center gap-0.5">
							<IconMapPin className="shrink-0" size={12} />
							<span className="truncate">{session.storeName}</span>
						</div>
					)}
				</div>
			</div>
			<div className="flex shrink-0 flex-col items-end">
				<span className={`font-semibold text-sm ${profitColorClass}`}>
					{plDisplay}
				</span>
				{isTournament && session.beforeDeadline === true && (
					<span className="text-[10px] text-muted-foreground">
						- / - entries
					</span>
				)}
				{isTournament &&
					session.beforeDeadline !== true &&
					session.placement !== null && (
						<span className="text-[10px] text-muted-foreground">
							{session.placement}
							{session.totalEntries === null ? "" : `/${session.totalEntries}`}
							{" place"}
						</span>
					)}
			</div>
		</>
	);
}

export function SessionCard({
	bbBiMode,
	session,
	onEdit,
	onDelete,
	onReopen,
	onViewEvents,
}: SessionCardProps) {
	const { isSharing, onShare } = useSessionCard(session);
	const isTournament = session.kind === "tournament";
	const isLive = session.source === "live";

	return (
		<EntityListItem
			actions={
				<Button
					disabled={isSharing}
					onClick={onShare}
					size="xs"
					type="button"
					variant="ghost"
				>
					<IconShare2 size={14} />
					{isSharing ? "Sharing..." : "Share"}
				</Button>
			}
			deleteLabel="session"
			onDelete={() => onDelete(session.id)}
			onEdit={() => onEdit(session)}
			summary={
				<div className="flex w-full items-start justify-between gap-3 pr-1 text-left">
					<SessionHeader bbBiMode={bbBiMode} session={session} />
				</div>
			}
		>
			<div className="flex flex-col gap-1 text-xs">
				{isTournament ? (
					<TournamentDetails session={session} />
				) : (
					<CashGameDetails session={session} />
				)}
				{session.memo && (
					<div className="mt-2 border-t pt-2">
						<p className="whitespace-pre-wrap text-muted-foreground">
							{session.memo}
						</p>
					</div>
				)}
				<div className="mt-2 flex items-center gap-2 border-t pt-2">
					<Button asChild className="px-0" size="xs" variant="link">
						<a href={`/sessions/${session.id}`}>
							<IconArrowRight size={12} />
							Detail
						</a>
					</Button>
					{isLive && onViewEvents && (
						<Button
							className="px-0"
							onClick={() =>
								onViewEvents({
									sessionId: session.id,
									sessionType: isTournament ? "tournament" : "cash-game",
								})
							}
							size="xs"
							type="button"
							variant="link"
						>
							<IconList size={12} />
							Events
						</Button>
					)}
					{isLive && onReopen && session.status === "completed" && (
						<Button
							className="px-0"
							onClick={() => onReopen(session.id)}
							size="xs"
							type="button"
							variant="link"
						>
							<IconPlayerPlay size={12} />
							Reopen
						</Button>
					)}
				</div>
			</div>
		</EntityListItem>
	);
}
