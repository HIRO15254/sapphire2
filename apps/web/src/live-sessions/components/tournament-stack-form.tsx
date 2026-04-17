import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import z from "zod";
import { ChipPurchaseSheet } from "@/live-sessions/components/chip-purchase-sheet";
import { MemoFields } from "@/live-sessions/components/event-fields/memo-fields";
import { StackNumberField } from "@/live-sessions/components/stack-ui";
import { useTournamentFormContext } from "@/live-sessions/hooks/use-session-form";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

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

const tournamentStackFormSchema = z.object({
	stackAmount: z.coerce
		.number({ invalid_type_error: "Stack amount is required" })
		.min(0, "Stack amount must be 0 or greater"),
	recordTournamentInfo: z.boolean(),
	remainingPlayers: z.coerce
		.number()
		.int()
		.min(1, "Must be at least 1")
		.optional(),
	totalEntries: z.coerce.number().int().min(1, "Must be at least 1").optional(),
	chipPurchaseCounts: z.array(
		z.object({
			name: z.string(),
			count: z.number().int().min(0),
			chipsPerUnit: z.number(),
		})
	),
});

export function TournamentStackForm({
	chipPurchaseTypes = [],
	isLoading,
	onComplete,
	onMemo,
	onPause,
	onPurchaseChips,
	onSubmit,
}: TournamentStackFormProps) {
	const { state: stackFormState, setStackAmount: setContextStackAmount } =
		useTournamentFormContext();
	const [chipPurchaseSheetOpen, setChipPurchaseSheetOpen] = useState(false);
	const [memoSheetOpen, setMemoSheetOpen] = useState(false);
	const [memoText, setMemoText] = useState("");

	const form = useForm({
		defaultValues: {
			stackAmount: stackFormState.stackAmount
				? Number(stackFormState.stackAmount)
				: (undefined as number | undefined),
			recordTournamentInfo: true,
			remainingPlayers: undefined as number | undefined,
			totalEntries: undefined as number | undefined,
			chipPurchaseCounts: [] as Array<{
				name: string;
				count: number;
				chipsPerUnit: number;
			}>,
		},
		onSubmit: ({ value }) => {
			onSubmit({
				stackAmount: value.stackAmount as number,
				recordTournamentInfo: value.recordTournamentInfo,
				remainingPlayers: value.remainingPlayers ?? null,
				totalEntries: value.totalEntries ?? null,
				chipPurchaseCounts: value.chipPurchaseCounts,
			});
		},
		validators: {
			onSubmit: tournamentStackFormSchema,
		},
	});

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
							id="tournament-stack-amount"
							inputMode="numeric"
							label="Current Stack"
							min={0}
							onChange={(value) => {
								field.handleChange(value === "" ? undefined : Number(value));
								setContextStackAmount(value);
							}}
							required
							type="number"
							value={
								field.state.value === undefined ? "" : String(field.state.value)
							}
						/>
					)}
				</form.Field>

				<form.Field name="recordTournamentInfo">
					{(field) => (
						<div className="flex items-center gap-2">
							<Checkbox
								checked={field.state.value}
								id="record-tournament-info"
								onCheckedChange={(checked) =>
									field.handleChange(checked === true)
								}
							/>
							<Label htmlFor="record-tournament-info">
								Record tournament info
							</Label>
						</div>
					)}
				</form.Field>

				<form.Subscribe selector={(state) => state.values.recordTournamentInfo}>
					{(recordTournamentInfo) =>
						recordTournamentInfo ? (
							<>
								<div className="grid grid-cols-2 gap-2">
									<form.Field name="remainingPlayers">
										{(field) => (
											<Field
												error={field.state.meta.errors[0]?.message}
												htmlFor={field.name}
												label="Remaining Players"
											>
												<Input
													id={field.name}
													inputMode="numeric"
													min={1}
													name={field.name}
													onBlur={field.handleBlur}
													onChange={(e) =>
														field.handleChange(
															e.target.value === ""
																? undefined
																: Number(e.target.value)
														)
													}
													type="number"
													value={field.state.value ?? ""}
												/>
											</Field>
										)}
									</form.Field>
									<form.Field name="totalEntries">
										{(field) => (
											<Field
												error={field.state.meta.errors[0]?.message}
												htmlFor={field.name}
												label="Total Entries"
											>
												<Input
													id={field.name}
													inputMode="numeric"
													min={1}
													name={field.name}
													onBlur={field.handleBlur}
													onChange={(e) =>
														field.handleChange(
															e.target.value === ""
																? undefined
																: Number(e.target.value)
														)
													}
													type="number"
													value={field.state.value ?? ""}
												/>
											</Field>
										)}
									</form.Field>
								</div>

								{chipPurchaseTypes.length > 0 && (
									<div className="flex flex-col gap-1.5">
										{chipPurchaseTypes.map((t) => (
											<form.Field key={t.name} name="chipPurchaseCounts">
												{(field) => {
													const counts = field.state.value;
													const countEntry = counts.find(
														(c) => c.name === t.name
													);
													const countValue = countEntry?.count ?? 0;
													return (
														<StackNumberField
															id={`chip-purchase-count-${t.name}`}
															inputMode="numeric"
															label={`${t.name} count`}
															min={0}
															onChange={(value) => {
																const newCount = Number(value);
																const without = counts.filter(
																	(c) => c.name !== t.name
																);
																if (newCount === 0) {
																	field.handleChange(without);
																} else {
																	field.handleChange([
																		...without,
																		{
																			name: t.name,
																			count: newCount,
																			chipsPerUnit: t.chips,
																		},
																	]);
																}
															}}
															type="number"
															value={countValue === 0 ? "" : String(countValue)}
														/>
													);
												}}
											</form.Field>
										))}
									</div>
								)}
							</>
						) : null
					}
				</form.Subscribe>

				<form.Subscribe>
					{(state) => (
						<Button
							className="w-full"
							disabled={isLoading || !state.canSubmit || state.isSubmitting}
							type="submit"
						>
							{isLoading || state.isSubmitting ? "..." : "Update"}
						</Button>
					)}
				</form.Subscribe>
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
