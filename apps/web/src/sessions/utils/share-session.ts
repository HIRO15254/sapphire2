export interface ShareableSession {
	addonCost: number | null;
	beforeDeadline: boolean | null;
	bountyPrizes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	currencyUnit: string | null;
	endedAt: string | null;
	entryFee: number | null;
	evProfitLoss: number | null;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number | null;
	rebuyCost: number | null;
	rebuyCount: number | null;
	ringGameBlind2: number | null;
	ringGameName: string | null;
	sessionDate: string;
	startedAt: string | null;
	storeName: string | null;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
	tournamentName: string | null;
	type: string;
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

function formatDuration(
	startedAt: string | null,
	endedAt: string | null
): string | null {
	if (!(startedAt && endedAt)) {
		return null;
	}
	const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
	const hours = diffMs / (1000 * 60 * 60);
	return `${hours.toFixed(1)}h`;
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

	if (session.type === "tournament") {
		if (session.prizeMoney !== null && session.prizeMoney > 0) {
			const prize = formatCompactNumberForShare(session.prizeMoney);
			line += ` (Prize: +${prize} ${currencyUnit})`;
		}
	} else {
		const duration = formatDuration(session.startedAt, session.endedAt);
		if (session.evProfitLoss !== null) {
			const evSign = session.evProfitLoss >= 0 ? "+" : "";
			const evAmount = formatCompactNumberForShare(session.evProfitLoss);
			line += ` (EV: ${evSign}${evAmount} ${currencyUnit})`;
		}
		if (duration) {
			line += ` / ${duration}`;
		}
	}

	return line;
}

export function createSessionShareText(session: ShareableSession): string {
	const isTournament = session.type === "tournament";
	const gameName = isTournament
		? session.tournamentName || "Tournament"
		: session.ringGameName || "Cash Game";
	const profitLoss = session.profitLoss ?? 0;
	const plIcon = profitLoss >= 0 ? "📈" : "📉";
	const plSign = profitLoss >= 0 ? "+" : "";
	const currencyUnit = session.currencyUnit ?? "";
	const date = new Date(session.sessionDate).toLocaleDateString("ja-JP");
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
