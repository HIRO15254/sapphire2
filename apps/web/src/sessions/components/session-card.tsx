import {
	IconBolt,
	IconCalendar,
	IconList,
	IconMapPin,
	IconPlayerPlay,
	IconPokerChip,
	IconTrophy,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { EntityListItem } from "@/shared/components/management/entity-list-item";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatCompactNumber } from "@/utils/format-number";

interface SessionCardProps {
	bbBiMode?: boolean;
	onDelete: (id: string) => void;
	onEdit: (session: SessionCardProps["session"]) => void;
	onReopen?: (liveCashGameSessionId: string) => void;
	session: {
		addonCost: number | null;
		bountyPrizes: number | null;
		buyIn: number | null;
		cashOut: number | null;
		createdAt: string;
		currencyId: string | null;
		currencyName: string | null;
		currencyUnit: string | null;
		endedAt: string | null;
		entryFee: number | null;
		evCashOut: number | null;
		evDiff: number | null;
		evProfitLoss: number | null;
		id: string;
		liveCashGameSessionId: string | null;
		liveTournamentSessionId: string | null;
		memo: string | null;
		placement: number | null;
		prizeMoney: number | null;
		profitLoss: number | null;
		rebuyCost: number | null;
		rebuyCount: number | null;
		ringGameBlind2: number | null;
		ringGameId: string | null;
		ringGameName: string | null;
		sessionDate: string;
		startedAt: string | null;
		storeId: string | null;
		storeName: string | null;
		tags: Array<{ id: string; name: string }>;
		totalEntries: number | null;
		tournamentBuyIn: number | null;
		tournamentId: string | null;
		tournamentName: string | null;
		type: string;
	};
}

function formatSessionDate(date: string): string {
	const d = new Date(date);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}/${m}/${day}`;
}

function getGameName(session: SessionCardProps["session"]): string {
	if (session.type === "tournament" && session.tournamentName) {
		return session.tournamentName;
	}
	if (session.type === "cash_game" && session.ringGameName) {
		return session.ringGameName;
	}
	return session.type === "tournament" ? "Tournament" : "Cash Game";
}

function formatProfitLoss(
	profitLoss: number,
	currencyUnit: string | null
): string {
	const sign = profitLoss >= 0 ? "+" : "";
	const value = formatCompactNumber(profitLoss);
	if (currencyUnit) {
		return `${sign}${value} ${currencyUnit}`;
	}
	return `${sign}${value}`;
}

function toBB(value: number, blind2: number | null): number | null {
	if (blind2 === null || blind2 === 0) {
		return null;
	}
	return value / blind2;
}

function computeTotalCost(session: SessionCardProps["session"]): number {
	return (
		(session.tournamentBuyIn ?? 0) +
		(session.entryFee ?? 0) +
		(session.rebuyCount ?? 0) * (session.rebuyCost ?? 0) +
		(session.addonCost ?? 0)
	);
}

function toBI(profitLoss: number, totalCost: number): number | null {
	if (totalCost === 0) {
		return null;
	}
	return profitLoss / totalCost;
}

function formatBBBI(value: number, unit: "BB" | "BI"): string {
	const decimals = unit === "BI" ? 2 : 1;
	return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)} ${unit}`;
}

function formatDuration(startedAt: string, endedAt: string): string {
	const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
	const hours = Math.floor(diffMs / (1000 * 60 * 60));
	const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
	if (hours > 0 && minutes > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (hours > 0) {
		return `${hours}h`;
	}
	return `${minutes}m`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex justify-between gap-2">
			<span className="text-muted-foreground">{label}</span>
			<span className="text-right">{value}</span>
		</div>
	);
}

function formatDetailValue(
	value: number,
	blind2: number | null,
	bbBiMode?: boolean
): string {
	if (bbBiMode) {
		const bb = toBB(value, blind2);
		if (bb !== null) {
			return `${bb.toFixed(1)} BB`;
		}
	}
	return formatCompactNumber(value);
}

function CashGameDetails({
	bbBiMode,
	session,
}: {
	bbBiMode?: boolean;
	session: SessionCardProps["session"];
}) {
	const rows: Array<{ label: string; value: string }> = [];
	if (session.buyIn !== null) {
		rows.push({
			label: "Buy-in",
			value: formatDetailValue(session.buyIn, session.ringGameBlind2, bbBiMode),
		});
	}
	if (session.cashOut !== null) {
		rows.push({
			label: "Cash-out",
			value: formatDetailValue(
				session.cashOut,
				session.ringGameBlind2,
				bbBiMode
			),
		});
	}
	if (session.evCashOut !== null) {
		rows.push({
			label: "EV Cash-out",
			value: formatDetailValue(
				session.evCashOut,
				session.ringGameBlind2,
				bbBiMode
			),
		});
	}
	if (session.evProfitLoss !== null) {
		const evValue = bbBiMode
			? (() => {
					const bb = toBB(session.evProfitLoss, session.ringGameBlind2);
					return bb === null
						? `${session.evProfitLoss >= 0 ? "+" : ""}${formatCompactNumber(session.evProfitLoss)}`
						: formatBBBI(bb, "BB");
				})()
			: `${session.evProfitLoss >= 0 ? "+" : ""}${formatCompactNumber(session.evProfitLoss)}`;
		rows.push({
			label: "EV P&L",
			value: evValue,
		});
	}
	if (session.currencyName) {
		rows.push({ label: "Currency", value: session.currencyName });
	}
	if (session.startedAt && session.endedAt) {
		rows.push({
			label: "Duration",
			value: formatDuration(session.startedAt, session.endedAt),
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
	if (session.entryFee !== null && session.entryFee > 0) {
		rows.push({
			label: "Entry Fee",
			value: formatCompactNumber(session.entryFee),
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
	if (session.rebuyCount !== null && session.rebuyCount > 0) {
		const cost = session.rebuyCost ?? 0;
		rows.push({
			label: "Rebuy",
			value: `${session.rebuyCount} × ${formatCompactNumber(cost)}`,
		});
	}
	if (session.addonCost !== null && session.addonCost > 0) {
		rows.push({
			label: "Addon",
			value: formatCompactNumber(session.addonCost),
		});
	}
	if (session.currencyName) {
		rows.push({ label: "Currency", value: session.currencyName });
	}
	if (session.startedAt && session.endedAt) {
		rows.push({
			label: "Duration",
			value: formatDuration(session.startedAt, session.endedAt),
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

function getPlDisplay(
	session: SessionCardProps["session"],
	profitLoss: number,
	bbBiMode?: boolean
): string {
	if (!bbBiMode) {
		return formatProfitLoss(profitLoss, session.currencyUnit);
	}
	if (session.type === "tournament") {
		const bi = toBI(profitLoss, computeTotalCost(session));
		return bi === null
			? formatProfitLoss(profitLoss, session.currencyUnit)
			: formatBBBI(bi, "BI");
	}
	const bb = toBB(profitLoss, session.ringGameBlind2);
	return bb === null
		? formatProfitLoss(profitLoss, session.currencyUnit)
		: formatBBBI(bb, "BB");
}

function getEvDisplay(
	session: SessionCardProps["session"],
	bbBiMode?: boolean
): string | null {
	if (session.type === "tournament" || session.evProfitLoss === null) {
		return null;
	}
	if (!bbBiMode) {
		return formatProfitLoss(session.evProfitLoss, session.currencyUnit);
	}
	const evBB = toBB(session.evProfitLoss, session.ringGameBlind2);
	return evBB === null
		? formatProfitLoss(session.evProfitLoss, session.currencyUnit)
		: formatBBBI(evBB, "BB");
}

function getProfitColorClass(profitLoss: number): string {
	if (profitLoss > 0) {
		return "text-green-600";
	}
	if (profitLoss < 0) {
		return "text-red-600";
	}
	return "text-foreground";
}

function SessionHeader({
	bbBiMode,
	session,
}: {
	bbBiMode?: boolean;
	session: SessionCardProps["session"];
}) {
	const profitLoss = session.profitLoss ?? 0;
	const isTournament = session.type === "tournament";
	const hasLiveRecording =
		session.liveCashGameSessionId !== null ||
		session.liveTournamentSessionId !== null;
	const plDisplay = getPlDisplay(session, profitLoss, bbBiMode);
	const profitColorClass = getProfitColorClass(profitLoss);
	const gameName = getGameName(session);
	const evDisplay = getEvDisplay(session, bbBiMode);

	return (
		<>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="relative shrink-0">
						{isTournament ? (
							<IconTrophy
								className="text-amber-500 dark:text-amber-400"
								size={16}
							/>
						) : (
							<IconPokerChip
								className="text-emerald-500 dark:text-emerald-400"
								size={16}
							/>
						)}
						{hasLiveRecording && (
							<IconBolt
								className="absolute -bottom-1 -right-1 text-muted-foreground"
								size={8}
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
				<div className="mt-1 flex items-center gap-3 text-muted-foreground text-xs">
					{session.storeName && (
						<span className="flex max-w-[120px] items-center gap-0.5">
							<IconMapPin className="shrink-0" size={12} />
							<span className="truncate">{session.storeName}</span>
						</span>
					)}
					<span className="flex items-center gap-0.5">
						<IconCalendar className="shrink-0" size={12} />
						{formatSessionDate(session.sessionDate)}
					</span>
				</div>
			</div>
			<div className="flex shrink-0 flex-col items-end">
				<span className={`font-semibold text-sm ${profitColorClass}`}>
					{plDisplay}
				</span>
				{isTournament && session.placement !== null && (
					<span className="text-[10px] text-muted-foreground">
						{session.placement}
						{session.totalEntries === null ? "" : `/${session.totalEntries}`}
						{" place"}
					</span>
				)}
				{evDisplay !== null && (
					<span className="text-[10px] text-muted-foreground">
						EV{" "}
						<span
							className={
								(session.evProfitLoss ?? 0) >= 0
									? "text-green-600"
									: "text-red-600"
							}
						>
							{evDisplay}
						</span>
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
}: SessionCardProps) {
	const isTournament = session.type === "tournament";
	const liveSessionId =
		session.liveCashGameSessionId ?? session.liveTournamentSessionId;

	return (
		<EntityListItem
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
					<CashGameDetails bbBiMode={bbBiMode} session={session} />
				)}
				{session.memo && (
					<div className="mt-2 border-t pt-2">
						<p className="whitespace-pre-wrap text-muted-foreground">
							{session.memo}
						</p>
					</div>
				)}
				{liveSessionId && (
					<div className="mt-2 flex items-center gap-2 border-t pt-2">
						<Button asChild className="px-0" size="xs" variant="link">
							<Link
								params={{
									sessionType: isTournament ? "tournament" : "cash-game",
									sessionId: liveSessionId,
								}}
								to="/live-sessions/$sessionType/$sessionId/events"
							>
								<IconList size={12} />
								Events
							</Link>
						</Button>
						{onReopen && (
							<Button
								className="px-0"
								onClick={() => onReopen(liveSessionId)}
								size="xs"
								type="button"
								variant="link"
							>
								<IconPlayerPlay size={12} />
								Reopen
							</Button>
						)}
					</div>
				)}
			</div>
		</EntityListItem>
	);
}
