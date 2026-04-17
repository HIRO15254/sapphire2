export interface ShareableSession {
	addonCost: number | null;
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

export function createSessionShareText(session: ShareableSession): string {
	const isTournament = session.type === "tournament";
	const gameName = isTournament
		? session.tournamentName || "Tournament"
		: session.ringGameName || "Cash Game";
	const profitLoss = session.profitLoss ?? 0;
	const sign = profitLoss >= 0 ? "+" : "";
	const currencyUnit = session.currencyUnit ?? "";
	const date = new Date(session.sessionDate).toLocaleDateString("ja-JP");

	const venue = session.storeName ? ` @ ${session.storeName}` : "";

	let text = "📊 Poker Session Result\n";
	text += `\n🃏 ${gameName}${venue}\n`;
	text += `📅 ${date}\n`;
	text += `\n💰 P&L: ${sign}${formatCompactNumberForShare(profitLoss)} ${currencyUnit}\n`;

	if (isTournament) {
		if (session.placement !== null) {
			const ordinal = formatOrdinal(session.placement);
			const entries =
				session.totalEntries === null
					? ""
					: ` / ${session.totalEntries} entries`;
			text += `🏆 ${ordinal}${entries}\n`;
		}
		if (session.prizeMoney !== null && session.prizeMoney > 0) {
			text += `Prize: +${formatCompactNumberForShare(session.prizeMoney)} ${currencyUnit}\n`;
		}
	} else if (session.evProfitLoss !== null) {
		const evSign = session.evProfitLoss >= 0 ? "+" : "";
		text += `📈 EV P&L: ${evSign}${formatCompactNumberForShare(session.evProfitLoss)} ${currencyUnit}\n`;
	}

	text += `\n#Poker${isTournament ? " #Tournament" : " #CashGame"}`;

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
