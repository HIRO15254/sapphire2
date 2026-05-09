export interface ShareableSession {
	beforeDeadline: boolean | null;
	bountyPrizes: number | null;
	breakMinutes: number | null;
	cashBuyIn: number | null;
	cashOut: number | null;
	currencyUnit: string | null;
	endedAt: string | Date | null;
	evCashOut: number | null;
	kind: string;
	placement: number | null;
	prizeMoney: number | null;
	ringGameName: string | null;
	sessionDate: string | Date;
	startedAt: string | Date | null;
	storeName: string | null;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
	tournamentEntryFee: number | null;
	tournamentName: string | null;
}

function formatCompactNumberForShare(value: number): string {
	if (Math.abs(value) >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1)}M`;
	}
	if (Math.abs(value) >= 1000) {
		return `${(value / 1000).toFixed(1)}K`;
	}
	return Math.round(value).toString();
}

function formatOrdinal(n: number): string {
	const suffix = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return `${n}${suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]}`;
}

function toDateString(value: string | Date | null): string | null {
	if (value === null) {
		return null;
	}
	return typeof value === "string" ? value : value.toISOString();
}

function formatDuration(
	startedAt: string | Date | null,
	endedAt: string | Date | null
): string | null {
	const start = toDateString(startedAt);
	const end = toDateString(endedAt);
	if (!(start && end)) {
		return null;
	}
	const diffMs = new Date(end).getTime() - new Date(start).getTime();
	const hours = diffMs / (1000 * 60 * 60);
	return `${hours.toFixed(1)}h`;
}

function computeCashProfitLoss(session: ShareableSession): number {
	return (session.cashOut ?? 0) - (session.cashBuyIn ?? 0);
}

function computeTournamentProfitLoss(session: ShareableSession): number {
	const income = session.prizeMoney ?? 0;
	const cost =
		(session.tournamentBuyIn ?? 0) + (session.tournamentEntryFee ?? 0);
	return income - cost;
}

function computeProfitLoss(session: ShareableSession): number {
	if (session.kind === "tournament") {
		return computeTournamentProfitLoss(session);
	}
	return computeCashProfitLoss(session);
}

function computeEvProfitLoss(session: ShareableSession): number | null {
	if (session.kind === "tournament") {
		return null;
	}
	if (session.evCashOut === null) {
		return null;
	}
	return session.evCashOut - (session.cashBuyIn ?? 0);
}

function buildProfitLossLine(
	session: ShareableSession,
	plIcon: string,
	plSign: string,
	profitLoss: number,
	currencyUnit: string
): string {
	const baseAmount = formatCompactNumberForShare(profitLoss);
	let line = `${plIcon} ${plSign}${baseAmount} ${currencyUnit}`;

	if (session.kind === "tournament") {
		if (session.prizeMoney !== null && session.prizeMoney > 0) {
			const prize = formatCompactNumberForShare(session.prizeMoney);
			line += ` (Prize: +${prize} ${currencyUnit})`;
		}
	} else {
		const duration = formatDuration(session.startedAt, session.endedAt);
		const evProfitLoss = computeEvProfitLoss(session);
		if (evProfitLoss !== null) {
			const evSign = evProfitLoss >= 0 ? "+" : "";
			const evAmount = formatCompactNumberForShare(evProfitLoss);
			line += ` (EV: ${evSign}${evAmount} ${currencyUnit})`;
		}
		if (duration) {
			line += ` / ${duration}`;
		}
	}

	return line;
}

export function createSessionShareText(session: ShareableSession): string {
	const isTournament = session.kind === "tournament";
	const gameName = isTournament
		? session.tournamentName || "Tournament"
		: session.ringGameName || "Cash Game";
	const profitLoss = computeProfitLoss(session);
	const plIcon = profitLoss >= 0 ? "📈" : "📉";
	const plSign = profitLoss >= 0 ? "+" : "";
	const currencyUnit = session.currencyUnit ?? "";
	const sessionDateStr = toDateString(session.sessionDate) ?? "";
	const date = new Date(sessionDateStr).toLocaleDateString("ja-JP");
	const gameIcon = isTournament ? "🏆" : "💲";

	let text = "📊 Poker Session Result\n";
	text += `\n📅 ${date}\n`;

	if (session.storeName) {
		text += `📍 ${session.storeName}\n`;
	}

	text += `\n${gameIcon} ${gameName}\n`;

	if (isTournament && session.beforeDeadline === true) {
		text += "🧾 - / - entries\n";
	} else if (isTournament && session.placement !== null) {
		const ordinal = formatOrdinal(session.placement);
		const entries =
			session.totalEntries === null ? "" : ` / ${session.totalEntries} entries`;
		text += `🧾 ${ordinal}${entries}\n`;
	}

	const plLine = buildProfitLossLine(
		session,
		plIcon,
		plSign,
		profitLoss,
		currencyUnit
	);
	text += `${plLine}\n`;

	return text;
}

export async function shareSession(session: ShareableSession): Promise<void> {
	const text = createSessionShareText(session);

	if (navigator.share) {
		await navigator.share({
			text,
			title: "Poker Session Result",
		});
	} else {
		await navigator.clipboard.writeText(text);
	}
}
