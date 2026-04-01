import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface TournamentRebuySheetProps {
	initialValues?: { cost: number; chips: number };
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (rebuy: { cost: number; chips: number }) => void;
	open: boolean;
}

export function TournamentRebuySheet({
	open,
	onOpenChange,
	initialValues,
	onSubmit,
	onDelete,
}: TournamentRebuySheetProps) {
	const [cost, setCost] = useState(initialValues?.cost ?? 0);
	const [chips, setChips] = useState(initialValues?.chips ?? 0);

	useEffect(() => {
		if (open) {
			setCost(initialValues?.cost ?? 0);
			setChips(initialValues?.chips ?? 0);
		}
	}, [open, initialValues?.cost, initialValues?.chips]);

	const isEditMode = initialValues !== undefined;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit({ cost, chips });
	};

	return (
		<ResponsiveDialog
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit Rebuy" : "Add Rebuy"}
		>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="rebuy-cost">Rebuy Cost</Label>
					<Input
						id="rebuy-cost"
						min={0}
						onChange={(e) => setCost(Math.round(Number(e.target.value)))}
						required
						step={1}
						type="number"
						value={cost}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="rebuy-chips">Chips Received</Label>
					<Input
						id="rebuy-chips"
						min={0}
						onChange={(e) => setChips(Math.round(Number(e.target.value)))}
						required
						step={1}
						type="number"
						value={chips}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Button type="submit">{isEditMode ? "Save" : "Add Rebuy"}</Button>
					{onDelete && (
						<Button onClick={onDelete} type="button" variant="destructive">
							Delete
						</Button>
					)}
				</div>
			</form>
		</ResponsiveDialog>
	);
}
