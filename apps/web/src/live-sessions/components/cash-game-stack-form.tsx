import { useState } from "react";
import { AddonBottomSheet } from "@/live-sessions/components/addon-bottom-sheet";
import { AllInBottomSheet } from "@/live-sessions/components/all-in-bottom-sheet";
import { MemoFields } from "@/live-sessions/components/event-fields";
import {
	StackNumberField,
	StackPrimaryRow,
} from "@/live-sessions/components/stack-ui";
import { useStackFormContext } from "@/live-sessions/hooks/use-session-form";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface CashGameStackFormProps {
	isLoading: boolean;
	onAllIn: (values: {
		potSize: number;
		trials: number;
		equity: number;
		wins: number;
	}) => void;
	onChipAdd: (amount: number) => void;
	onChipRemove: (amount: number) => void;
	onComplete: (currentStack: number) => void;
	onMemo: (text: string) => void;
	onPause: () => void;
	onSubmit: (values: { stackAmount: number }) => void;
}

export function CashGameStackForm({
	isLoading,
	onAllIn,
	onChipAdd,
	onChipRemove,
	onComplete,
	onMemo,
	onPause,
	onSubmit,
}: CashGameStackFormProps) {
	const { state, setStackAmount } = useStackFormContext();
	const { stackAmount } = state;

	const [allInBottomSheetOpen, setAllInBottomSheetOpen] = useState(false);
	const [addonBottomSheetOpen, setAddonBottomSheetOpen] = useState(false);
	const [removeBottomSheetOpen, setRemoveBottomSheetOpen] = useState(false);
	const [memoBottomSheetOpen, setMemoBottomSheetOpen] = useState(false);
	const [memoText, setMemoText] = useState("");

	const handleAllInSubmit = (values: {
		potSize: number;
		trials: number;
		equity: number;
		wins: number;
	}) => {
		onAllIn(values);
		setAllInBottomSheetOpen(false);
	};

	const handleAddonSubmit = (values: { amount: number }) => {
		onChipAdd(values.amount);
		const currentStack = Number(stackAmount) || 0;
		setStackAmount(String(currentStack + values.amount));
		setAddonBottomSheetOpen(false);
	};

	const handleRemoveSubmit = (values: { amount: number }) => {
		onChipRemove(values.amount);
		setRemoveBottomSheetOpen(false);
	};

	const handleMemoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		e.stopPropagation();
		onMemo(memoText);
		setMemoText("");
		setMemoBottomSheetOpen(false);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		onSubmit({ stackAmount: Number(stackAmount) });
	};

	const handleComplete = () => {
		onComplete(Number(stackAmount) || 0);
	};

	return (
		<div className="flex flex-col gap-4">
			<form onSubmit={handleSubmit}>
				<StackPrimaryRow>
					<StackNumberField
						className="sm:min-w-[12rem]"
						id="cash-stack-amount"
						inputMode="numeric"
						label="Current Stack"
						min={0}
						onChange={setStackAmount}
						required
						type="number"
						value={stackAmount}
					/>
					<Button disabled={isLoading} size="sm" type="submit">
						{isLoading ? "..." : "Update"}
					</Button>
				</StackPrimaryRow>
			</form>

			<div className="-mx-4 border-t" />

			<div className="flex flex-col gap-2">
				<p className="font-medium text-muted-foreground text-xs">Events</p>
				<div className="grid grid-cols-2 gap-2">
					<Button
						onClick={() => setAllInBottomSheetOpen(true)}
						type="button"
						variant="outline"
					>
						All-in
					</Button>
					<Button
						onClick={() => setAddonBottomSheetOpen(true)}
						type="button"
						variant="outline"
					>
						Add Chips
					</Button>
					<Button
						onClick={() => setRemoveBottomSheetOpen(true)}
						type="button"
						variant="outline"
					>
						Remove Chips
					</Button>
					<Button
						onClick={() => setMemoBottomSheetOpen(true)}
						type="button"
						variant="outline"
					>
						Memo
					</Button>
				</div>
			</div>

			<div className="-mx-4 border-t" />

			<div className="flex flex-col gap-2">
				<p className="font-medium text-muted-foreground text-xs">Session</p>
				<div className="grid grid-cols-2 gap-2">
					<Button onClick={onPause} type="button" variant="outline">
						Pause
					</Button>
					<Button onClick={handleComplete} type="button" variant="outline">
						Complete
					</Button>
				</div>
			</div>

			<AllInBottomSheet
				onOpenChange={setAllInBottomSheetOpen}
				onSubmit={handleAllInSubmit}
				open={allInBottomSheetOpen}
			/>

			<AddonBottomSheet
				onOpenChange={setAddonBottomSheetOpen}
				onSubmit={handleAddonSubmit}
				open={addonBottomSheetOpen}
			/>

			<AddonBottomSheet
				onOpenChange={setRemoveBottomSheetOpen}
				onSubmit={handleRemoveSubmit}
				open={removeBottomSheetOpen}
			/>

			<ResponsiveDialog
				onOpenChange={setMemoBottomSheetOpen}
				open={memoBottomSheetOpen}
				title="Add Memo"
			>
				<form className="flex flex-col gap-4" onSubmit={handleMemoSubmit}>
					<MemoFields onTextChange={setMemoText} text={memoText} />
					<DialogActionRow>
						<Button
							onClick={() => setMemoBottomSheetOpen(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button type="submit">Add Memo</Button>
					</DialogActionRow>
				</form>
			</ResponsiveDialog>
		</div>
	);
}
