import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import z from "zod";
import { AddonBottomSheet } from "@/live-sessions/components/addon-bottom-sheet";
import { AllInBottomSheet } from "@/live-sessions/components/all-in-bottom-sheet";
import { MemoFields } from "@/live-sessions/components/event-fields/memo-fields";
import {
	StackPrimaryRow,
} from "@/live-sessions/components/stack-ui";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
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

const cashGameStackFormSchema = z.object({
	stackAmount: z.coerce
		.number({ invalid_type_error: "Stack amount is required" })
		.min(0, "Stack amount must be 0 or greater"),
});

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
	const [allInBottomSheetOpen, setAllInBottomSheetOpen] = useState(false);
	const [addonBottomSheetOpen, setAddonBottomSheetOpen] = useState(false);
	const [removeBottomSheetOpen, setRemoveBottomSheetOpen] = useState(false);
	const [memoBottomSheetOpen, setMemoBottomSheetOpen] = useState(false);
	const [memoText, setMemoText] = useState("");

	const form = useForm({
		defaultValues: {
			stackAmount: undefined as number | undefined,
		},
		onSubmit: ({ value }) => {
			onSubmit({ stackAmount: value.stackAmount as number });
		},
		validators: {
			onSubmit: cashGameStackFormSchema,
		},
	});

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
		const currentStack = form.getFieldValue("stackAmount") ?? 0;
		form.setFieldValue("stackAmount", (currentStack as number) + values.amount);
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

	const handleComplete = () => {
		const currentStack = form.getFieldValue("stackAmount") ?? 0;
		onComplete((currentStack as number) || 0);
	};

	return (
		<div className="flex flex-col gap-4">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<StackPrimaryRow>
					<form.Field name="stackAmount">
						{(field) => (
							<Field
								className="sm:min-w-[12rem]"
								error={field.state.meta.errors[0]?.message}
								htmlFor={field.name}
								label="Current Stack"
								required
							>
								<Input
									id={field.name}
									inputMode="numeric"
									min={0}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(
											e.target.value === "" ? undefined : Number(e.target.value)
										)
									}
									type="number"
									value={field.state.value !== undefined ? String(field.state.value) : ""}
								/>
							</Field>
						)}
					</form.Field>
					<form.Subscribe>
						{(state) => (
							<Button
								disabled={isLoading || !state.canSubmit || state.isSubmitting}
								size="sm"
								type="submit"
							>
								{isLoading || state.isSubmitting ? "..." : "Update"}
							</Button>
						)}
					</form.Subscribe>
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
