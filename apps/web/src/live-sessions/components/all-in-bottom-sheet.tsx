import { useEffect, useState } from "react";
import { AllInFields } from "@/live-sessions/components/event-fields/all-in-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		e.stopPropagation();
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
				<AllInFields
					equity={equity}
					onEquityChange={setEquity}
					onPotSizeChange={setPotSize}
					onTrialsChange={(v) => setTrials(v)}
					onWinsChange={setWins}
					potSize={potSize}
					trials={trials}
					wins={wins}
				/>
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
