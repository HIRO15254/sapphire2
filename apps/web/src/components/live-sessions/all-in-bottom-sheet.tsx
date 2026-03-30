import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>{isEditMode ? "Edit All-in" : "Add All-in"}</DrawerTitle>
				</DrawerHeader>
				<form
					className="flex flex-col gap-4 overflow-y-auto px-4"
					onSubmit={handleSubmit}
				>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="allIn-potSize">Pot Size</Label>
						<Input
							id="allIn-potSize"
							min={0}
							onChange={(e) => setPotSize(Number(e.target.value))}
							required
							step="any"
							type="number"
							value={potSize}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="allIn-trials">Trials</Label>
						<Input
							id="allIn-trials"
							min={1}
							onChange={(e) => setTrials(Math.round(Number(e.target.value)))}
							required
							step={1}
							type="number"
							value={trials}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="allIn-equity">Equity %</Label>
						<Input
							id="allIn-equity"
							max={100}
							min={0}
							onChange={(e) => setEquity(Number(e.target.value))}
							step={0.1}
							type="number"
							value={equity}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="allIn-wins">
							Wins{" "}
							<span className="text-muted-foreground text-xs">
								(decimal allowed for chop)
							</span>
						</Label>
						<Input
							id="allIn-wins"
							min={0}
							onChange={(e) => setWins(Number(e.target.value))}
							step={0.1}
							type="number"
							value={wins}
						/>
					</div>
					<div className="rounded-lg bg-muted p-3 text-sm">
						<p>EV Amount: {evAmount.toFixed(2)}</p>
						<p>Actual: {actual.toFixed(2)}</p>
						<p>EV Diff: {evDiff.toFixed(2)}</p>
					</div>
					<DrawerFooter className="px-0">
						<Button type="submit">{isEditMode ? "Save" : "Add All-in"}</Button>
						{onDelete && (
							<Button onClick={onDelete} type="button" variant="destructive">
								Delete
							</Button>
						)}
					</DrawerFooter>
				</form>
			</DrawerContent>
		</Drawer>
	);
}
