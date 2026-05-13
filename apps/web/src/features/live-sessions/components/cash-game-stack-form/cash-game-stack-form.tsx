import { AddonBottomSheet } from "@/features/live-sessions/components/addon-bottom-sheet";
import { AllInBottomSheet } from "@/features/live-sessions/components/all-in-bottom-sheet";
import { MemoFields } from "@/features/live-sessions/components/event-fields/memo-fields";
import {
	StackNumberField,
	StackPrimaryRow,
} from "@/features/live-sessions/components/stack-ui";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useCashGameStackForm } from "./use-cash-game-stack-form";

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
	const {
		stackForm,
		memoForm,
		stackAmount,
		setStackAmount,
		allInBottomSheetOpen,
		setAllInBottomSheetOpen,
		addonBottomSheetOpen,
		setAddonBottomSheetOpen,
		removeBottomSheetOpen,
		setRemoveBottomSheetOpen,
		memoBottomSheetOpen,
		setMemoBottomSheetOpen,
	} = useCashGameStackForm({ onMemo, onSubmit });

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

	const handleComplete = () => {
		onComplete(Number(stackAmount) || 0);
	};

	return (
		<div className="flex flex-col gap-4">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					stackForm.handleSubmit();
				}}
			>
				<StackPrimaryRow>
					<stackForm.Field name="stackAmount">
						{(field) => (
							<StackNumberField
								className="sm:min-w-[12rem]"
								error={field.state.meta.errors[0]?.message}
								id="cash-stack-amount"
								inputMode="numeric"
								label="Current Stack"
								onChange={(v) => {
									field.handleChange(v);
									setStackAmount(v);
								}}
								required
								value={field.state.value}
							/>
						)}
					</stackForm.Field>
					<Button disabled={isLoading} size="sm" type="submit">
						{isLoading ? "..." : "Update"}
					</Button>
				</StackPrimaryRow>
			</form>

			<div className="-mx-4 border-t" />

			<div className="flex flex-col gap-2">
				<p className="font-medium text-muted-foreground text-xs">Timeline</p>
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
				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						memoForm.handleSubmit();
					}}
				>
					<memoForm.Field name="text">
						{(field) => (
							<MemoFields
								onTextChange={(v) => field.handleChange(v)}
								text={field.state.value}
							/>
						)}
					</memoForm.Field>
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
