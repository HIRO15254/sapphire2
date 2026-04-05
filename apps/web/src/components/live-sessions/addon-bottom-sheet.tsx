import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogActionRow } from "@/components/ui/dialog-action-row";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface AddonBottomSheetProps {
	initialAmount?: number;
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (addon: { amount: number }) => void;
	open: boolean;
}

export function AddonBottomSheet({
	open,
	onOpenChange,
	initialAmount,
	onSubmit,
	onDelete,
}: AddonBottomSheetProps) {
	const [amount, setAmount] = useState(initialAmount ?? 0);

	useEffect(() => {
		if (open) {
			setAmount(initialAmount ?? 0);
		}
	}, [open, initialAmount]);

	const isEditMode = initialAmount !== undefined;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit({ amount });
	};

	return (
		<ResponsiveDialog
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit Addon" : "Add Addon"}
		>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
				<Field htmlFor="addon-amount" label="Addon Amount" required>
					<Input
						id="addon-amount"
						min={0}
						onChange={(e) => setAmount(Math.round(Number(e.target.value)))}
						required
						step={1}
						type="number"
						value={amount}
					/>
				</Field>
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
					<Button type="submit">{isEditMode ? "Save" : "Add Addon"}</Button>
				</DialogActionRow>
			</form>
		</ResponsiveDialog>
	);
}
