import { formatCompactNumber } from "@/utils/format-number";
import { formatSessionDuration } from "./session-display";
export interface ShareableSession {
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
	ringGameBlind2: number | null;
	ringGameName: string | null;
	roomName: string | null;
	sessionDate: string;
	startedAt: string | null;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
	tournamentName: string | null;
	type: string;
}

function formatOrdinal(n: number): string {
	const suffix = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return `${n}${suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]}`;
}

function buildProfitLossLine(
	session: ShareableSession,
	plIcon: string,
	plSign: string,
	profitLoss: number,
	currencyUnit: string
): string {
	const baseAmount = formatCompactNumber(profitLoss);
	let line = `${plIcon} ${plSign}${baseAmount} ${currencyUnit}`;

	if (session.type === "tournament") {
		if (session.prizeMoney !== null && session.prizeMoney > 0) {
			const prize = formatCompactNumber(session.prizeMoney);
			line += ` (Prize: +${prize} ${currencyUnit})`;
		}
	} else {
		const duration = formatSessionDuration(session.startedAt, session.endedAt);
		if (session.evProfitLoss !== null) {
			const evSign = session.evProfitLoss >= 0 ? "+" : "";
			const evAmount = formatCompactNumber(session.evProfitLoss);
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
	// sessionDate is UTC midnight; force UTC so the shared date is the calendar
	// day the user saved rather than its local rendering (SA2-145).
	const date = new Date(session.sessionDate).toLocaleDateString("ja-JP", {
		timeZone: "UTC",
	});
	const gameIcon = isTournament ? "🏆" : "💲";

	let text = "📊 Poker Session Result\n";
	text += `\n📅 ${date}\n`;

	if (session.roomName) {
		text += `📍 ${session.roomName}\n`;
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
