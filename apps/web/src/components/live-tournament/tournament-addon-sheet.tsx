import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface TournamentAddonSheetProps {
	initialValues?: { cost: number; chips: number };
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (addon: { cost: number; chips: number }) => void;
	open: boolean;
}

export function TournamentAddonSheet({
	open,
	onOpenChange,
	initialValues,
	onSubmit,
	onDelete,
}: TournamentAddonSheetProps) {
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
			title={isEditMode ? "Edit Addon" : "Add Addon"}
		>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="addon-cost">Addon Cost</Label>
					<Input
						id="addon-cost"
						min={0}
						onChange={(e) => setCost(Math.round(Number(e.target.value)))}
						required
						step={1}
						type="number"
						value={cost}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="addon-chips">Chips Received</Label>
					<Input
						id="addon-chips"
						min={0}
						onChange={(e) => setChips(Math.round(Number(e.target.value)))}
						required
						step={1}
						type="number"
						value={chips}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Button type="submit">{isEditMode ? "Save" : "Add Addon"}</Button>
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
