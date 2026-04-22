import { ChipPurchaseSheet } from "@/features/live-sessions/components/chip-purchase-sheet";
import { MemoFields } from "@/features/live-sessions/components/event-fields/memo-fields";
import { StackNumberField } from "@/features/live-sessions/components/stack-ui";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Label } from "@/shared/components/ui/label";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useTournamentStackForm } from "./use-tournament-stack-form";

interface ChipPurchaseType {
	chips: number;
	cost: number;
	name: string;
}

interface TournamentStackFormSubmitValues {
	chipPurchaseCounts: Array<{
		chipsPerUnit: number;
		count: number;
		name: string;
	}>;
	recordTournamentInfo: boolean;
	remainingPlayers: number | null;
	stackAmount: number;
	totalEntries: number | null;
}

interface TournamentStackFormProps {
	chipPurchaseTypes?: ChipPurchaseType[];
	isLoading: boolean;
	onComplete: () => void;
	onMemo: (text: string) => void;
	onPause: () => void;
	onPurchaseChips: (values: {
		chips: number;
		cost: number;
		name: string;
	}) => void;
	onSubmit: (values: TournamentStackFormSubmitValues) => void;
}

export function TournamentStackForm({
	chipPurchaseTypes = [],
	isLoading,
	onComplete,
	onMemo,
	onPause,
	onPurchaseChips,
	onSubmit,
}: TournamentStackFormProps) {
	const {
		form,
		memoForm,
		setStackAmount,
		setRemainingPlayers,
		setTotalEntries,
		chipPurchaseCounts,
		setChipPurchaseCounts,
		recordTournamentInfo,
		setRecordTournamentInfo,
		chipPurchaseSheetOpen,
		setChipPurchaseSheetOpen,
		memoSheetOpen,
		setMemoSheetOpen,
	} = useTournamentStackForm({ onMemo, onSubmit });

	const handleChipPurchaseSubmit = (values: {
		chips: number;
		cost: number;
		name: string;
	}) => {
		onPurchaseChips(values);
		setChipPurchaseSheetOpen(false);
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
				<form.Field name="stackAmount">
					{(field) => (
						<StackNumberField
							error={field.state.meta.errors[0]?.message}
							id="tournament-stack-amount"
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

				<div className="flex items-center gap-2">
					<Checkbox
						checked={recordTournamentInfo}
						id="record-tournament-info"
						onCheckedChange={(checked) =>
							setRecordTournamentInfo(checked === true)
						}
					/>
					<Label htmlFor="record-tournament-info">Record tournament info</Label>
				</div>

				{recordTournamentInfo && (
					<>
						<div className="grid grid-cols-2 gap-2">
							<form.Field name="remainingPlayers">
								{(field) => (
									<StackNumberField
										error={field.state.meta.errors[0]?.message}
										id="tournament-remaining-players"
										inputMode="numeric"
										label="Remaining Players"
										onChange={(v) => {
											field.handleChange(v);
											setRemainingPlayers(v);
										}}
										value={field.state.value}
									/>
								)}
							</form.Field>
							<form.Field name="totalEntries">
								{(field) => (
									<StackNumberField
										error={field.state.meta.errors[0]?.message}
										id="tournament-total-entries"
										inputMode="numeric"
										label="Total Entries"
										onChange={(v) => {
											field.handleChange(v);
											setTotalEntries(v);
										}}
										value={field.state.value}
									/>
								)}
							</form.Field>
						</div>

						{chipPurchaseTypes.length > 0 && (
							<div className="flex flex-col gap-1.5">
								{chipPurchaseTypes.map((t) => {
									const countEntry = chipPurchaseCounts.find(
										(c) => c.name === t.name
									);
									const countValue = countEntry?.count ?? 0;
									return (
										<StackNumberField
											id={`chip-purchase-count-${t.name}`}
											inputMode="numeric"
											key={t.name}
											label={`${t.name} count`}
											onChange={(value) => {
												const newCount = Number(value);
												setChipPurchaseCounts((prev) => {
													const without = prev.filter((c) => c.name !== t.name);
													if (!newCount) {
														return without;
													}
													return [
														...without,
														{
															name: t.name,
															count: newCount,
															chipsPerUnit: t.chips,
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

				<Button className="w-full" disabled={isLoading} type="submit">
					{isLoading ? "..." : "Update"}
				</Button>
			</form>

			<div className="-mx-4 border-t" />

			<div className="flex flex-col gap-2">
				<p className="font-medium text-muted-foreground text-xs">Events</p>
				<div className="grid grid-cols-2 gap-2">
					<Button
						onClick={() => setChipPurchaseSheetOpen(true)}
						type="button"
						variant="outline"
					>
						Chip Purchase
					</Button>
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
					<Button onClick={onComplete} type="button" variant="outline">
						Complete
					</Button>
				</div>
			</div>

			<ChipPurchaseSheet
				onOpenChange={setChipPurchaseSheetOpen}
				onSubmit={handleChipPurchaseSubmit}
				open={chipPurchaseSheetOpen}
				shortcuts={chipPurchaseTypes}
			/>

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
