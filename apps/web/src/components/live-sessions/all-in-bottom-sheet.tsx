import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogActionRow } from "@/components/ui/dialog-action-row";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface AllIn {
	equity: number;
	potSize: number;
	trials: number;
	wins: number;
}

interface AllInBottomSheetProps {
	initialValues?: AllIn;
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (allIn: AllIn) => void;
	open: boolean;
}

const DEFAULT_VALUES: AllIn = {
	potSize: 0,
	trials: 1,
	equity: 0,
	wins: 0,
};

export function AllInBottomSheet({
	open,
	onOpenChange,
	initialValues,
	onSubmit,
	onDelete,
}: AllInBottomSheetProps) {
	const [potSize, setPotSize] = useState(
		initialValues?.potSize ?? DEFAULT_VALUES.potSize
	);
	const [trials, setTrials] = useState(
		initialValues?.trials ?? DEFAULT_VALUES.trials
	);
	const [equity, setEquity] = useState(
		initialValues?.equity ?? DEFAULT_VALUES.equity
	);
	const [wins, setWins] = useState(initialValues?.wins ?? DEFAULT_VALUES.wins);

	useEffect(() => {
		if (open) {
			setPotSize(initialValues?.potSize ?? DEFAULT_VALUES.potSize);
			setTrials(initialValues?.trials ?? DEFAULT_VALUES.trials);
			setEquity(initialValues?.equity ?? DEFAULT_VALUES.equity);
			setWins(initialValues?.wins ?? DEFAULT_VALUES.wins);
		}
	}, [open, initialValues]);

	const isEditMode = initialValues !== undefined;

	const evAmount = potSize * (equity / 100) * trials;
	const actual = potSize * wins;
	const evDiff = evAmount - actual;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit({ potSize, trials, equity, wins });
	};

	return (
		<ResponsiveDialog
			description="Capture the pot size, equity, and result for an all-in spot."
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit All-in" : "Add All-in"}
		>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
				<Field htmlFor="allIn-potSize" label="Pot Size" required>
					<Input
						id="allIn-potSize"
						min={0}
						onChange={(e) => setPotSize(Number(e.target.value))}
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
						onChange={(e) => setTrials(Math.round(Number(e.target.value)))}
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
						onChange={(e) => setEquity(Number(e.target.value))}
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
						onChange={(e) => setWins(Number(e.target.value))}
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
				<DialogActionRow>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					{onDelete ? (
						<Button onClick={onDelete} type="button" variant="destructive">
							Delete
						</Button>
					) : null}
					<Button type="submit">{isEditMode ? "Save" : "Add All-in"}</Button>
				</DialogActionRow>
			</form>
		</ResponsiveDialog>
	);
}
