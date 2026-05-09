interface CashResult {
	buyIn?: number | null;
	cashOut?: number | null;
	evCashOut?: number | null;
}

interface TournamentResult {
	beforeDeadline?: boolean | null;
	bountyPrizes?: number | null;
	buyIn?: number | null;
	entryFee?: number | null;
	placement?: number | null;
	prizeMoney?: number | null;
	totalEntries?: number | null;
}

interface ResultSectionProps {
	cashResult?: CashResult | null;
	kind: "cash_game" | "tournament";
	tournamentResult?: TournamentResult | null;
}

function ResultRow({
	label,
	value,
}: {
	label: string;
	value?: string | number | null;
}) {
	if (value == null) {
		return null;
	}
	return (
		<div className="flex justify-between py-1 text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span>{value}</span>
		</div>
	);
}

export function ResultSection({
	cashResult,
	kind,
	tournamentResult,
}: ResultSectionProps) {
	if (kind === "cash_game") {
		const profit =
			cashResult?.cashOut != null && cashResult?.buyIn != null
				? cashResult.cashOut - cashResult.buyIn
				: null;

		return (
			<div className="flex flex-col divide-y">
				<ResultRow label="Buy-in" value={cashResult?.buyIn} />
				<ResultRow label="Cash-out" value={cashResult?.cashOut} />
				<ResultRow label="EV Cash-out" value={cashResult?.evCashOut} />
				{profit != null && (
					<ResultRow
						label="Profit"
						value={`${profit >= 0 ? "+" : ""}${profit}`}
					/>
				)}
			</div>
		);
	}

	if (tournamentResult?.beforeDeadline) {
		return (
			<div className="flex flex-col divide-y">
				<ResultRow label="Buy-in" value={tournamentResult?.buyIn} />
				<ResultRow label="Entry fee" value={tournamentResult?.entryFee} />
				<div className="py-1 text-sm">
					<span className="text-muted-foreground">Status</span>
					<span className="ml-2 text-xs">Busted before deadline</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col divide-y">
			<ResultRow label="Buy-in" value={tournamentResult?.buyIn} />
			<ResultRow label="Entry fee" value={tournamentResult?.entryFee} />
			<ResultRow label="Placement" value={tournamentResult?.placement} />
			<ResultRow label="Total entries" value={tournamentResult?.totalEntries} />
			<ResultRow label="Prize money" value={tournamentResult?.prizeMoney} />
			<ResultRow label="Bounty prizes" value={tournamentResult?.bountyPrizes} />
		</div>
	);
}
