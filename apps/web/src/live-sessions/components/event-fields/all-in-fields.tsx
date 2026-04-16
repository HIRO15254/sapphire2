import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface AllInFieldsProps {
	equity: number;
	onEquityChange: (v: number) => void;
	onPotSizeChange: (v: number) => void;
	onTrialsChange: (v: number) => void;
	onWinsChange: (v: number) => void;
	potSize: number;
	trials: number;
	wins: number;
}

export function AllInFields({
	equity,
	onEquityChange,
	onPotSizeChange,
	onTrialsChange,
	onWinsChange,
	potSize,
	trials,
	wins,
}: AllInFieldsProps) {
	const evAmount = potSize * (equity / 100);
	const actual = (potSize / trials) * wins;
	const evDiff = evAmount - actual;

	return (
		<>
			<Field htmlFor="allIn-potSize" label="Pot Size" required>
				<Input
					id="allIn-potSize"
					min={0}
					onChange={(e) => onPotSizeChange(Number(e.target.value))}
					required
					step="any"
					type="number"
					value={potSize}
				/>
			</Field>
			<Field htmlFor="allIn-trials" label="Trials" required>
				<Input
					id="allIn-trials"
					min={1}
					onChange={(e) => onTrialsChange(Math.round(Number(e.target.value)))}
					required
					step={1}
					type="number"
					value={trials}
				/>
			</Field>
			<Field htmlFor="allIn-equity" label="Equity %">
				<Input
					id="allIn-equity"
					max={100}
					min={0}
					onChange={(e) => onEquityChange(Number(e.target.value))}
					step={0.1}
					type="number"
					value={equity}
				/>
			</Field>
			<Field
				description="Decimal values are allowed for chopped pots."
				htmlFor="allIn-wins"
				label="Wins"
			>
				<Input
					id="allIn-wins"
					min={0}
					onChange={(e) => onWinsChange(Number(e.target.value))}
					step={0.1}
					type="number"
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
