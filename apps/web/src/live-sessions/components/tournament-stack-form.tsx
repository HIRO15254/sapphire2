import { useState } from "react";
import { ChipPurchaseSheet } from "@/live-sessions/components/chip-purchase-sheet";
import { MemoFields } from "@/live-sessions/components/event-fields";
import { StackNumberField } from "@/live-sessions/components/stack-ui";
import { useTournamentFormContext } from "@/live-sessions/hooks/use-session-form";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Label } from "@/shared/components/ui/label";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface ChipPurchaseType {
	chips: number;
	cost: number;
	name: string;
}

interface TournamentStackFormSubmitValues {
	chipPurchaseCounts: Array<{ chipsPerUnit: number; count: number; name: string }>;
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
	const { state, setStackAmount, setRemainingPlayers, setTotalEntries, setChipPurchaseCounts } =
		useTournamentFormContext();
	const { stackAmount, remainingPlayers, totalEntries, chipPurchaseCounts } = state;

	const [recordTournamentInfo, setRecordTournamentInfo] = useState(true);
	const [chipPurchaseSheetOpen, setChipPurchaseSheetOpen] = useState(false);
	const [memoSheetOpen, setMemoSheetOpen] = useState(false);
	const [memoText, setMemoText] = useState("");

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		onSubmit({
			stackAmount: Number(stackAmount),
			recordTournamentInfo,
			remainingPlayers: remainingPlayers ? Number(remainingPlayers) : null,
			totalEntries: totalEntries ? Number(totalEntries) : null,
			chipPurchaseCounts,
		});
	};

	const handleChipPurchaseSubmit = (values: {
		chips: number;
		cost: number;
		name: string;
	}) => {
		onPurchaseChips(values);
		setChipPurchaseSheetOpen(false);
	};

	const handleMemoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		e.stopPropagation();
		onMemo(memoText);
		setMemoText("");
		setMemoSheetOpen(false);
	};

	return (
		<div className="flex flex-col gap-4">
			<form className="flex flex-col gap-3" onSubmit={handleSubmit}>
				<StackNumberField
					id="tournament-stack-amount"
					inputMode="numeric"
					label="Current Stack"
					min={0}
					onChange={setStackAmount}
					required
					type="number"
					value={stackAmount}
				/>

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
							<StackNumberField
								id="tournament-remaining-players"
								inputMode="numeric"
								label="Remaining Players"
								min={1}
								onChange={setRemainingPlayers}
								type="number"
								value={remainingPlayers}
							/>
							<StackNumberField
								id="tournament-total-entries"
								inputMode="numeric"
								label="Total Entries"
								min={1}
								onChange={setTotalEntries}
								type="number"
								value={totalEntries}
							/>
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
											min={0}
											onChange={(value) => {
												const newCount = Number(value);
												setChipPurchaseCounts((prev) => {
													const without = prev.filter((c) => c.name !== t.name);
													if (newCount === 0) {
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
											type="number"
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
				<form className="flex flex-col gap-4" onSubmit={handleMemoSubmit}>
					<MemoFields onTextChange={setMemoText} text={memoText} />
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
