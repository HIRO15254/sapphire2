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
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>{isEditMode ? "Edit Addon" : "Add Addon"}</DrawerTitle>
				</DrawerHeader>
				<form
					className="flex flex-col gap-4 overflow-y-auto px-4"
					onSubmit={handleSubmit}
				>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="addon-amount">Addon Amount</Label>
						<Input
							id="addon-amount"
							min={0}
							onChange={(e) => setAmount(Math.round(Number(e.target.value)))}
							required
							step={1}
							type="number"
							value={amount}
						/>
					</div>
					<DrawerFooter className="px-0">
						<Button type="submit">{isEditMode ? "Save" : "Add Addon"}</Button>
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
