import { AddonBottomSheet } from "@/features/live-sessions/components/addon-bottom-sheet";
import { AllInBottomSheet } from "@/features/live-sessions/components/all-in-bottom-sheet";
import { MemoFields } from "@/features/live-sessions/components/event-fields/memo-fields";
import {
	StackNumberField,
	StackPrimaryRow,
} from "@/features/live-sessions/components/stack-ui";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Label } from "@/shared/components/ui/label";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { ChipPurchaseSheet } from "../chip-purchase-sheet";
import type { ChipPurchaseType, StackFormSubmitValues } from "./use-stack-form";
import { useStackForm } from "./use-stack-form";

interface StackFormBasicProps {
	isLoading: boolean;
	onAllIn?: (values: {
		potSize: number;
		trials: number;
		equity: number;
		wins: number;
	}) => void;
	onChipAdd?: (amount: number) => void;
	onChipRemove?: (amount: number) => void;
	onComplete: (currentStack: number) => void;
	onMemo: (text: string) => void;
	onPause: () => void;
	onSubmit: (values: StackFormSubmitValues) => void;
}

interface CashStackFormProps extends StackFormBasicProps {
	kind: "cash_game";
}

interface TournamentStackFormProps extends StackFormBasicProps {
	chipPurchaseTypes?: ChipPurchaseType[];
	kind: "tournament";
	onPurchaseChips: (values: { chipPurchaseOptionId: string }) => void;
}

type StackFormProps = CashStackFormProps | TournamentStackFormProps;

export function StackForm(props: StackFormProps) {
	const {
		kind,
		isLoading,
		onAllIn,
		onChipAdd,
		onChipRemove,
		onComplete,
		onMemo,
		onPause,
		onSubmit,
	} = props;

	const {
		form,
		memoForm,
		stackAmount,
		setStackAmount,
		chipPurchaseCounts,
		setChipPurchaseCounts,
		chipPurchaseTypes,
		recordTournamentInfo,
		setRecordTournamentInfo,
		chipPurchaseSheetOpen,
		setChipPurchaseSheetOpen,
		allInBottomSheetOpen,
		setAllInBottomSheetOpen,
		addonBottomSheetOpen,
		setAddonBottomSheetOpen,
		removeBottomSheetOpen,
		setRemoveBottomSheetOpen,
		memoSheetOpen,
		setMemoSheetOpen,
		handleChipPurchase,
	} = useStackForm(
		kind === "cash_game"
			? { kind: "cash_game", onMemo, onSubmit }
			: {
					kind: "tournament",
					chipPurchaseTypes: (props as TournamentStackFormProps)
						.chipPurchaseTypes,
					onMemo,
					onSubmit,
					onPurchaseChips: (props as TournamentStackFormProps).onPurchaseChips,
				}
	);

	const handleAddonSubmit = (values: { amount: number }) => {
		onChipAdd?.(values.amount);
		const cur = Number(stackAmount) || 0;
		setStackAmount(String(cur + values.amount));
		setAddonBottomSheetOpen(false);
	};

	const handleRemoveSubmit = (values: { amount: number }) => {
		onChipRemove?.(values.amount);
		setRemoveBottomSheetOpen(false);
	};

	const handleAllInSubmit = (values: {
		potSize: number;
		trials: number;
		equity: number;
		wins: number;
	}) => {
		onAllIn?.(values);
		setAllInBottomSheetOpen(false);
	};

	return (
		<div className="flex flex-col gap-4">
			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<StackPrimaryRow>
					<form.Field name="stackAmount">
						{(field) => (
							<StackNumberField
								className="sm:min-w-[12rem]"
								error={field.state.meta.errors[0]?.message}
								id="stack-amount"
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
					</form.Field>
					<Button disabled={isLoading} size="sm" type="submit">
						{isLoading ? "..." : "Update"}
					</Button>
				</StackPrimaryRow>

				{kind === "tournament" && (
					<>
						<div className="flex items-center gap-2">
							<Checkbox
								checked={recordTournamentInfo}
								id="record-tournament-info"
								onCheckedChange={(v) => setRecordTournamentInfo(v === true)}
							/>
							<Label htmlFor="record-tournament-info">
								Record tournament info
							</Label>
						</div>

						{recordTournamentInfo && (
							<>
								<div className="grid grid-cols-2 gap-2">
									<form.Field name="remainingPlayers">
										{(field) => (
											<StackNumberField
												error={field.state.meta.errors[0]?.message}
												id="remaining-players"
												inputMode="numeric"
												label="Remaining Players"
												onChange={(v) => field.handleChange(v)}
												value={field.state.value}
											/>
										)}
									</form.Field>
									<form.Field name="totalEntries">
										{(field) => (
											<StackNumberField
												error={field.state.meta.errors[0]?.message}
												id="total-entries"
												inputMode="numeric"
												label="Total Entries"
												onChange={(v) => field.handleChange(v)}
												value={field.state.value}
											/>
										)}
									</form.Field>
								</div>

								{chipPurchaseTypes.length > 0 && (
									<div className="flex flex-col gap-1.5">
										{chipPurchaseTypes.map((t) => {
											const optionId = String(t.id);
											const entry = chipPurchaseCounts.find(
												(c) => c.chipPurchaseOptionId === optionId
											);
											const countValue = entry?.count ?? 0;
											return (
												<StackNumberField
													id={`chip-count-${optionId}`}
													inputMode="numeric"
													key={optionId}
													label={`${t.name} count`}
													onChange={(value) => {
														const newCount = Number(value);
														setChipPurchaseCounts((prev) => {
															const without = prev.filter(
																(c) => c.chipPurchaseOptionId !== optionId
															);
															if (!newCount) {
																return without;
															}
															return [
																...without,
																{
																	chipPurchaseOptionId: optionId,
																	count: newCount,
																},
															];
														});
													}}
													value={countValue === 0 ? "" : String(countValue)}
												/>
											);
										})}
									</div>
								)}
							</>
						)}
					</>
				)}
			</form>

			<div className="-mx-4 border-t" />

			<div className="flex flex-col gap-2">
				<p className="font-medium text-muted-foreground text-xs">Events</p>
				<div className="grid grid-cols-2 gap-2">
					{kind === "cash_game" && (
						<>
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
						</>
					)}
					{kind === "tournament" && (
						<Button
							onClick={() => setChipPurchaseSheetOpen(true)}
							type="button"
							variant="outline"
						>
							Chip Purchase
						</Button>
					)}
					<Button
						onClick={() => setMemoSheetOpen(true)}
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
					<Button
						onClick={() => onComplete(Number(stackAmount) || 0)}
						type="button"
						variant="outline"
					>
						Complete
					</Button>
				</div>
			</div>

			{kind === "cash_game" && (
				<>
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
				</>
			)}

			{kind === "tournament" && (
				<ChipPurchaseSheet
					onOpenChange={setChipPurchaseSheetOpen}
					onSubmit={handleChipPurchase}
					open={chipPurchaseSheetOpen}
					options={chipPurchaseTypes.map((t) => ({
						id: t.id,
						name: t.name,
						cost: t.cost,
						chips: t.chips,
					}))}
				/>
			)}

			<ResponsiveDialog
				onOpenChange={setMemoSheetOpen}
				open={memoSheetOpen}
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
							onClick={() => setMemoSheetOpen(false)}
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
