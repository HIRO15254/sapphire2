import type { MasterLinkCopy } from "@/features/live-sessions/utils/session-settings";
import {
	currencyRowLabel,
	describeMasterLink,
} from "@/features/live-sessions/utils/session-settings";

export type AnteType = "all" | "bb" | "none";

const ANTE_TYPE_KEYS: AnteType[] = ["all", "bb", "none"];

export interface SessionDetailLike {
	cashAnte?: number | null;
	cashAnteType?: string | null;
	cashBlind1?: number | null;
	cashBlind3?: number | null;
	cashMaxBuyIn?: number | null;
	cashMinBuyIn?: number | null;
	cashTableSize?: number | null;
	cashVariant?: string | null;
	currencyId?: string | null;
	currencyName?: string | null;
	currencyUnit?: string | null;
	entryFee?: number | null;
	memo?: string | null;
	ringGameBlind2?: number | null;
	ringGameId?: string | null;
	ringGameName?: string | null;
	roomName?: string | null;
	tags?: readonly { id: string; name: string }[];
	tournamentBountyAmount?: number | null;
	tournamentBuyIn?: number | null;
	tournamentId?: string | null;
	tournamentName?: string | null;
	tournamentStartingStack?: number | null;
	tournamentTableSize?: number | null;
	tournamentVariant?: string | null;
}

export interface SessionSheetView {
	anteType: AnteType;
	currencyLabel: string;
	currencyUnit: string | null;
	isMasterLinked: boolean;
	master: MasterLinkCopy;
	memo: string;
	roomName: string;
	ruleName: string;
	selectedCurrencyId: string | null;
	serverNumbers: Record<string, number | null>;
	tableSize: number | null;
	tags: readonly { id: string; name: string }[];
	variantLabel: string;
}

function serverNumbersOf(
	detail: SessionDetailLike | null
): Record<string, number | null> {
	return {
		ante: detail?.cashAnte ?? null,
		blind1: detail?.cashBlind1 ?? null,
		blind2: detail?.ringGameBlind2 ?? null,
		blind3: detail?.cashBlind3 ?? null,
		bountyAmount: detail?.tournamentBountyAmount ?? null,
		entryFee: detail?.entryFee ?? null,
		maxBuyIn: detail?.cashMaxBuyIn ?? null,
		minBuyIn: detail?.cashMinBuyIn ?? null,
		startingStack: detail?.tournamentStartingStack ?? null,
		tournamentBuyIn: detail?.tournamentBuyIn ?? null,
	};
}

function currencyLabelOf(detail: SessionDetailLike | null): string {
	const currencyId = detail?.currencyId ?? null;
	if (currencyId === null) {
		return currencyRowLabel(null);
	}
	return currencyRowLabel({
		id: currencyId,
		name: detail?.currencyName ?? "",
		unit: detail?.currencyUnit ?? null,
	});
}

export function describeSessionDetail(
	detail: SessionDetailLike | null,
	sessionType: "cash_game" | "tournament"
): SessionSheetView {
	const isCash = sessionType === "cash_game";
	const currencyId = detail?.currencyId ?? null;
	const masterId = (isCash ? detail?.ringGameId : detail?.tournamentId) ?? null;

	return {
		anteType:
			ANTE_TYPE_KEYS.find((key) => key === detail?.cashAnteType) ?? "none",
		currencyLabel: currencyLabelOf(detail),
		currencyUnit: detail?.currencyUnit ?? null,
		isMasterLinked: masterId !== null,
		master: describeMasterLink(
			masterId === null ? null : (detail?.roomName ?? "Linked"),
			sessionType
		),
		memo: detail?.memo ?? "",
		roomName: detail?.roomName ?? "Not set",
		ruleName: (isCash ? detail?.ringGameName : detail?.tournamentName) ?? "",
		selectedCurrencyId: currencyId,
		serverNumbers: serverNumbersOf(detail),
		tableSize:
			(isCash ? detail?.cashTableSize : detail?.tournamentTableSize) ?? null,
		tags: detail?.tags ?? [],
		variantLabel:
			(isCash ? detail?.cashVariant : detail?.tournamentVariant) ?? "",
	};
}
