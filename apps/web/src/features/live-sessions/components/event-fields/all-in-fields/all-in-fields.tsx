import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface AllInFieldsProps {
	equity: string;
	equityError?: string;
	onEquityChange: (v: string) => void;
	onPotSizeChange: (v: string) => void;
	onTrialsChange: (v: string) => void;
	onWinsChange: (v: string) => void;
	potSize: string;
	potSizeError?: string;
	trials: string;
	trialsError?: string;
	wins: string;
	winsError?: string;
}

export function AllInFields({
	equity,
	equityError,
	onEquityChange,
	onPotSizeChange,
	onTrialsChange,
	onWinsChange,
	potSize,
	potSizeError,
	trials,
	trialsError,
	wins,
	winsError,
}: AllInFieldsProps) {
	const potSizeNum = Number(potSize) || 0;
	const trialsNum = Number(trials) || 1;
	const equityNum = Number(equity) || 0;
	const winsNum = Number(wins) || 0;
	const evAmount = potSizeNum * (equityNum / 100);
	const actual = (potSizeNum / trialsNum) * winsNum;
	const evDiff = evAmount - actual;

	return (
		<>
			<Field
				error={potSizeError}
				htmlFor="allIn-potSize"
				label="Pot Size"
				required
			>
				<Input
					id="allIn-potSize"
					inputMode="decimal"
					onChange={(e) => onPotSizeChange(e.target.value)}
					value={potSize}
				/>
			</Field>
			<Field error={trialsError} htmlFor="allIn-trials" label="Trials" required>
				<Input
					id="allIn-trials"
					inputMode="numeric"
					onChange={(e) => onTrialsChange(e.target.value)}
					value={trials}
				/>
			</Field>
			<Field error={equityError} htmlFor="allIn-equity" label="Equity %">
				<Input
					id="allIn-equity"
					inputMode="decimal"
					onChange={(e) => onEquityChange(e.target.value)}
					value={equity}
				/>
			</Field>
			<Field
				description="Decimal values are allowed for chopped pots."
				error={winsError}
				htmlFor="allIn-wins"
				label="Wins"
			>
				<Input
					id="allIn-wins"
					inputMode="decimal"
					onChange={(e) => onWinsChange(e.target.value)}
					value={wins}
				/>
			</Field>
			<div className="rounded-lg bg-muted p-3 text-sm">
				<p>EV Amount: {evAmount.toFixed(2)}</p>
				<p>Actual: {actual.toFixed(2)}</p>
				<p>EV Diff: {evDiff.toFixed(2)}</p>
			</div>
		</>
	);
}
