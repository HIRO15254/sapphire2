import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { TagInput } from "@/shared/components/ui/tag-input";
import { Textarea } from "@/shared/components/ui/textarea";
import { CashGameFields } from "./cash-game-fields";
import { FormAccordion } from "./form-section";
import { StoreGameSelectors } from "./link-selectors";
import {
	TournamentDetailFields,
	TournamentPrimaryFields,
} from "./tournament-fields";

interface CashGameFormValues {
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	breakMinutes?: number;
	buyIn: number;
	cashOut: number;
	currencyId?: string;
	endTime?: string;
	evCashOut?: number;
	memo?: string;
	ringGameId?: string;
	sessionDate: string;
	startTime?: string;
	storeId?: string;
	tableSize?: number;
	tagIds?: string[];
	type: "cash_game";
	variant: string;
}

interface TournamentFormValues {
	addonCost?: number;
	bountyPrizes?: number;
	breakMinutes?: number;
	currencyId?: string;
	endTime?: string;
	entryFee?: number;
	memo?: string;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	sessionDate: string;
	startTime?: string;
	storeId?: string;
	tagIds?: string[];
	totalEntries?: number;
	tournamentBuyIn: number;
	tournamentId?: string;
	type: "tournament";
}

type SessionFormValues = CashGameFormValues | TournamentFormValues;

interface RingGameOption {
	ante?: number | null;
	anteType?: string | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	currencyId?: string | null;
	id: string;
	name: string;
	tableSize?: number | null;
	variant?: string | null;
}

interface TournamentOption {
	buyIn?: number | null;
	entryFee?: number | null;
	id: string;
	name: string;
}

interface SessionFormDefaults {
	addonCost?: number;
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	bountyPrizes?: number;
	breakMinutes?: number;
	buyIn?: number;
	cashOut?: number;
	currencyId?: string;
	endTime?: string;
	entryFee?: number;
	evCashOut?: number;
	memo?: string;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	ringGameId?: string;
	sessionDate?: string;
	startTime?: string;
	storeId?: string;
	tableSize?: number;
	tagIds?: string[];
	totalEntries?: number;
	tournamentBuyIn?: number;
	tournamentId?: string;
	type?: "cash_game" | "tournament";
	variant?: string;
}

interface SessionFormProps {
	currencies?: Array<{ id: string; name: string }>;
	defaultValues?: SessionFormDefaults;
	isLoading?: boolean;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onStoreChange?: (storeId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	stores?: Array<{ id: string; name: string }>;
	tags?: Array<{ id: string; name: string }>;
	tournaments?: TournamentOption[];
}

function getTodayDateString(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
	return value === null ? undefined : value;
}

// Zod schemas

const cashGameSchema = z.object({
	sessionType: z.literal("cash_game"),
	sessionDate: z
		.string()
		.min(1, "Session date is required")
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Session date must be in YYYY-MM-DD format"),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	breakMinutes: z
		.number()
		.int("Break time must be a whole number")
		.min(0, "Break time cannot be negative")
		.optional(),
	storeId: z.string().optional(),
	ringGameId: z.string().optional(),
	buyIn: z.number().min(0, "Buy-in cannot be negative"),
	cashOut: z.number().min(0, "Cash-out cannot be negative"),
	evCashOut: z
		.number()
		.min(0, "EV cash-out cannot be negative")
		.optional(),
	variant: z.string().min(1, "Variant is required"),
	blind1: z.number().min(0, "SB cannot be negative").optional(),
	blind2: z.number().min(0, "BB cannot be negative").optional(),
	blind3: z.number().min(0, "Straddle cannot be negative").optional(),
	anteType: z.string().optional(),
	ante: z.number().min(0, "Ante cannot be negative").optional(),
	tableSize: z
		.number()
		.int("Table size must be a whole number")
		.min(2, "Table size must be at least 2")
		.max(10, "Table size must be at most 10")
		.optional(),
	currencyId: z.string().optional(),
	tagIds: z.array(z.string()).optional(),
	memo: z.string().max(50_000, "Memo is too long").optional(),
});

const tournamentSchema = z.object({
	sessionType: z.literal("tournament"),
	sessionDate: z
		.string()
		.min(1, "Session date is required")
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Session date must be in YYYY-MM-DD format"),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	breakMinutes: z
		.number()
		.int("Break time must be a whole number")
		.min(0, "Break time cannot be negative")
		.optional(),
	storeId: z.string().optional(),
	tournamentId: z.string().optional(),
	tournamentBuyIn: z.number().min(0, "Buy-in cannot be negative"),
	entryFee: z.number().min(0, "Entry fee cannot be negative").optional(),
	placement: z
		.number()
		.int("Placement must be a whole number")
		.min(1, "Placement must be at least 1")
		.optional(),
	totalEntries: z
		.number()
		.int("Total entries must be a whole number")
		.min(1, "Total entries must be at least 1")
		.optional(),
	prizeMoney: z
		.number()
		.min(0, "Prize money cannot be negative")
		.optional(),
	rebuyCount: z
		.number()
		.int("Rebuy count must be a whole number")
		.min(0, "Rebuy count cannot be negative")
		.optional(),
	rebuyCost: z.number().min(0, "Rebuy cost cannot be negative").optional(),
	addonCost: z.number().min(0, "Addon cost cannot be negative").optional(),
	bountyPrizes: z
		.number()
		.min(0, "Bounty prizes cannot be negative")
		.optional(),
	currencyId: z.string().optional(),
	tagIds: z.array(z.string()).optional(),
	memo: z.string().max(50_000, "Memo is too long").optional(),
});

const sessionFormSchema = z.discriminatedUnion("sessionType", [
	cashGameSchema,
	tournamentSchema,
]);

type SessionFormInternalValues = z.infer<typeof sessionFormSchema>;

const NONE_VALUE = "__none__";

interface SessionFormFieldsProps {
	currencies?: Array<{ id: string; name: string }>;
	form: ReturnType<typeof useForm<SessionFormInternalValues>>;
	gameLabel: string;
	gameOptions?: Array<{ id: string; name: string }>;
	handleGameChange: (value: string) => void;
	handleStoreChange: (value: string) => void;
	isCashGame: boolean;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	stores?: Array<{ id: string; name: string }>;
	tags?: Array<{ id: string; name: string }>;
}

function SessionFormFields({
	currencies,
	form,
	gameLabel,
	gameOptions,
	handleGameChange,
	handleStoreChange,
	isCashGame,
	onCreateTag,
	stores,
	tags,
}: SessionFormFieldsProps) {
	const selectedStoreId = form.useStore((s) => {
		const v = s.values;
		if (v.sessionType === "cash_game") return v.storeId;
		return v.storeId;
	});

	const selectedGameId = form.useStore((s) => {
		const v = s.values;
		if (v.sessionType === "cash_game") return v.ringGameId;
		if (v.sessionType === "tournament") return v.tournamentId;
		return undefined;
	});

	const detailContent = isCashGame ? (
		<form.Field name="variant">
			{(variantField) => (
				<form.Field name="blind1">
					{(blind1Field) => (
						<form.Field name="blind2">
							{(blind2Field) => (
								<form.Field name="blind3">
									{(blind3Field) => (
										<form.Field name="anteType">
											{(anteTypeField) => (
												<form.Field name="ante">
													{(anteField) => (
														<form.Field name="tableSize">
															{(tableSizeField) => (
																<form.Field name="currencyId">
																	{(currencyField) => (
																		<CashGameFields
																			ante={anteField.state.value}
																			anteType={anteTypeField.state.value}
																			blind1={blind1Field.state.value}
																			blind2={blind2Field.state.value}
																			blind3={blind3Field.state.value}
																			currencies={currencies}
																			onAnteChange={(v) =>
																				anteField.handleChange(v)
																			}
																			onAnteTypeChange={(v) => {
																				anteTypeField.handleChange(v);
																				if (v === "none") {
																					anteField.handleChange(undefined);
																				}
																			}}
																			onBlind1Change={(v) =>
																				blind1Field.handleChange(v)
																			}
																			onBlind2Change={(v) =>
																				blind2Field.handleChange(v)
																			}
																			onBlind3Change={(v) =>
																				blind3Field.handleChange(v)
																			}
																			onCurrencyChange={(v) =>
																				currencyField.handleChange(v)
																			}
																			onTableSizeChange={(v) =>
																				tableSizeField.handleChange(v)
																			}
																			onVariantChange={(v) =>
																				variantField.handleChange(v)
																			}
																			selectedCurrencyId={
																				currencyField.state.value
																			}
																			tableSize={tableSizeField.state.value}
																			variant={variantField.state.value}
																		/>
																	)}
																</form.Field>
															)}
														</form.Field>
													)}
												</form.Field>
											)}
										</form.Field>
									)}
								</form.Field>
							)}
						</form.Field>
					)}
				</form.Field>
			)}
		</form.Field>
	) : (
		<form.Field name="rebuyCount">
			{(rebuyCountField) => (
				<form.Field name="rebuyCost">
					{(rebuyCostField) => (
						<form.Field name="addonCost">
							{(addonCostField) => (
								<form.Field name="bountyPrizes">
									{(bountyPrizesField) => (
										<form.Field name="currencyId">
											{(currencyField) => (
												<TournamentDetailFields
													addonCost={addonCostField.state.value}
													bountyPrizes={bountyPrizesField.state.value}
													currencies={currencies}
													onAddonCostChange={(v) =>
														addonCostField.handleChange(v)
													}
													onBountyPrizesChange={(v) =>
														bountyPrizesField.handleChange(v)
													}
													onCurrencyChange={(v) =>
														currencyField.handleChange(v)
													}
													onRebuyCostChange={(v) =>
														rebuyCostField.handleChange(v)
													}
													onRebuyCountChange={(v) =>
														rebuyCountField.handleChange(v)
													}
													rebuyCost={rebuyCostField.state.value}
													rebuyCount={rebuyCountField.state.value}
													selectedCurrencyId={currencyField.state.value}
												/>
											)}
										</form.Field>
									)}
								</form.Field>
							)}
						</form.Field>
					)}
				</form.Field>
			)}
		</form.Field>
	);

	const tagsContent = (
		<>
			<form.Field name="tagIds">
				{(tagIdsField) => (
					<Field label="Session Tags">
						<TagInput
							availableTags={tags}
							onAdd={(tag) =>
								tagIdsField.handleChange([
									...(tagIdsField.state.value ?? []),
									tag.id,
								])
							}
							onCreateTag={onCreateTag}
							onRemove={(tag) =>
								tagIdsField.handleChange(
									(tagIdsField.state.value ?? []).filter((id) => id !== tag.id)
								)
							}
							selectedTags={(tagIdsField.state.value ?? [])
								.map((id) => tags?.find((t) => t.id === id))
								.filter(
									(t): t is { id: string; name: string } => t !== undefined
								)}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="memo">
				{(memoField) => (
					<Field htmlFor="memo" label="Memo">
						<Textarea
							id="memo"
							name="memo"
							onBlur={memoField.handleBlur}
							onChange={(e) =>
								memoField.handleChange(e.target.value || undefined)
							}
							placeholder="Notes about this session"
							value={memoField.state.value ?? ""}
						/>
					</Field>
				)}
			</form.Field>
		</>
	);

	return (
		<>
			{/* === Top section (always visible) === */}
			<div className="flex flex-col gap-4">
				{/* Session Date */}
				<form.Field name="sessionDate">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor="sessionDate"
							label="Session Date"
							required
						>
							<Input
								id="sessionDate"
								name="sessionDate"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="date"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				{/* Start Time / End Time */}
				<div className="grid grid-cols-2 gap-3">
					<form.Field name="startTime">
						{(field) => (
							<Field htmlFor="startTime" label="Start Time">
								<Input
									id="startTime"
									name="startTime"
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(e.target.value || undefined)
									}
									type="time"
									value={field.state.value ?? ""}
								/>
							</Field>
						)}
					</form.Field>
					<form.Field name="endTime">
						{(field) => (
							<Field htmlFor="endTime" label="End Time">
								<Input
									id="endTime"
									name="endTime"
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(e.target.value || undefined)
									}
									type="time"
									value={field.state.value ?? ""}
								/>
							</Field>
						)}
					</form.Field>
				</div>

				{/* Break Time */}
				<form.Field name="breakMinutes">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor="breakMinutes"
							label="Break Time (min)"
						>
							<Input
								id="breakMinutes"
								inputMode="numeric"
								min={0}
								name="breakMinutes"
								onBlur={field.handleBlur}
								onChange={(e) => {
									const val = e.target.value;
									if (!val) {
										field.handleChange(undefined);
									} else {
										const parsed = Number.parseInt(val, 10);
										field.handleChange(
											Number.isNaN(parsed) ? undefined : parsed
										);
									}
								}}
								placeholder="0"
								type="number"
								value={field.state.value ?? ""}
							/>
						</Field>
					)}
				</form.Field>

				{/* Store / Game Selectors */}
				<StoreGameSelectors
					gameLabel={gameLabel}
					gameOptions={gameOptions}
					onGameChange={handleGameChange}
					onStoreChange={handleStoreChange}
					selectedGameId={selectedGameId}
					selectedStoreId={selectedStoreId}
					stores={stores}
				/>

				{/* Buy-in / Cash-out (cash game only) */}
				{isCashGame && (
					<>
						<div className="grid grid-cols-2 gap-3">
							<form.Field name="buyIn">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor="buyIn"
										label="Buy-in"
										required
									>
										<Input
											id="buyIn"
											inputMode="numeric"
											min={0}
											name="buyIn"
											onBlur={field.handleBlur}
											onChange={(e) => {
												const parsed = Number.parseFloat(e.target.value);
												field.handleChange(Number.isNaN(parsed) ? 0 : parsed);
											}}
											placeholder="0"
											type="number"
											value={field.state.value ?? ""}
										/>
									</Field>
								)}
							</form.Field>
							<form.Field name="cashOut">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor="cashOut"
										label="Cash-out"
										required
									>
										<Input
											id="cashOut"
											inputMode="numeric"
											min={0}
											name="cashOut"
											onBlur={field.handleBlur}
											onChange={(e) => {
												const parsed = Number.parseFloat(e.target.value);
												field.handleChange(Number.isNaN(parsed) ? 0 : parsed);
											}}
											placeholder="0"
											type="number"
											value={field.state.value ?? ""}
										/>
									</Field>
								)}
							</form.Field>
						</div>
						<form.Field name="evCashOut">
							{(field) => (
								<Field
									description="Expected value cash-out based on all-in equity. Leave empty if not tracking EV."
									error={field.state.meta.errors[0]?.message}
									htmlFor="evCashOut"
									label="EV Cash-out"
								>
									<Input
										id="evCashOut"
										inputMode="numeric"
										min={0}
										name="evCashOut"
										onBlur={field.handleBlur}
										onChange={(e) => {
											const val = e.target.value;
											if (!val) {
												field.handleChange(undefined);
											} else {
												const parsed = Number.parseFloat(val);
												field.handleChange(
													Number.isNaN(parsed) ? undefined : parsed
												);
											}
										}}
										placeholder="0"
										type="number"
										value={field.state.value ?? ""}
									/>
								</Field>
							)}
						</form.Field>
					</>
				)}

				{/* Tournament primary fields (outside accordion) */}
				{!isCashGame && (
					<form.Field name="tournamentBuyIn">
						{(buyInField) => (
							<form.Field name="entryFee">
								{(entryFeeField) => (
									<form.Field name="prizeMoney">
										{(prizeMoneyField) => (
											<form.Field name="placement">
												{(placementField) => (
													<form.Field name="totalEntries">
														{(totalEntriesField) => (
															<TournamentPrimaryFields
																entryFee={entryFeeField.state.value}
																onEntryFeeChange={(v) =>
																	entryFeeField.handleChange(v)
																}
																onPlacementChange={(v) =>
																	placementField.handleChange(v)
																}
																onPrizeMoneyChange={(v) =>
																	prizeMoneyField.handleChange(v)
																}
																onTotalEntriesChange={(v) =>
																	totalEntriesField.handleChange(v)
																}
																onTournamentBuyInChange={(v) =>
																	buyInField.handleChange(v)
																}
																placement={placementField.state.value}
																prizeMoney={prizeMoneyField.state.value}
																totalEntries={totalEntriesField.state.value}
																tournamentBuyIn={buyInField.state.value}
															/>
														)}
													</form.Field>
												)}
											</form.Field>
										)}
									</form.Field>
								)}
							</form.Field>
						)}
					</form.Field>
				)}
			</div>

			{/* === Accordion sections === */}
			<FormAccordion
				items={[
					{
						value: "detail",
						title: isCashGame ? "Detail" : "Tournament Details",
						children: detailContent,
					},
					{
						value: "tags",
						title: "Tags & Memo",
						children: tagsContent,
					},
				]}
			/>
		</>
	);
}

export function SessionForm({
	currencies,
	defaultValues,
	isLoading = false,
	onCreateTag,
	onStoreChange,
	onSubmit,
	ringGames,
	stores,
	tags,
	tournaments,
}: SessionFormProps) {
	const initialSessionType = defaultValues?.type ?? "cash_game";
	const isCashGameInitial = initialSessionType === "cash_game";

	const form = useForm<SessionFormInternalValues>({
		defaultValues: isCashGameInitial
			? ({
					sessionType: "cash_game" as const,
					sessionDate: defaultValues?.sessionDate ?? getTodayDateString(),
					startTime: defaultValues?.startTime,
					endTime: defaultValues?.endTime,
					breakMinutes: defaultValues?.breakMinutes,
					storeId: defaultValues?.storeId,
					ringGameId: defaultValues?.ringGameId,
					buyIn: defaultValues?.buyIn ?? 0,
					cashOut: defaultValues?.cashOut ?? 0,
					evCashOut: defaultValues?.evCashOut,
					variant: defaultValues?.variant ?? "nlh",
					blind1: defaultValues?.blind1,
					blind2: defaultValues?.blind2,
					blind3: defaultValues?.blind3,
					anteType: defaultValues?.anteType ?? "none",
					ante: defaultValues?.ante,
					tableSize: defaultValues?.tableSize,
					currencyId: defaultValues?.currencyId,
					tagIds: defaultValues?.tagIds ?? [],
					memo: defaultValues?.memo,
				} satisfies SessionFormInternalValues)
			: ({
					sessionType: "tournament" as const,
					sessionDate: defaultValues?.sessionDate ?? getTodayDateString(),
					startTime: defaultValues?.startTime,
					endTime: defaultValues?.endTime,
					breakMinutes: defaultValues?.breakMinutes,
					storeId: defaultValues?.storeId,
					tournamentId: defaultValues?.tournamentId,
					tournamentBuyIn: defaultValues?.tournamentBuyIn ?? 0,
					entryFee: defaultValues?.entryFee,
					placement: defaultValues?.placement,
					totalEntries: defaultValues?.totalEntries,
					prizeMoney: defaultValues?.prizeMoney,
					rebuyCount: defaultValues?.rebuyCount,
					rebuyCost: defaultValues?.rebuyCost,
					addonCost: defaultValues?.addonCost,
					bountyPrizes: defaultValues?.bountyPrizes,
					currencyId: defaultValues?.currencyId,
					tagIds: defaultValues?.tagIds ?? [],
					memo: defaultValues?.memo,
				} satisfies SessionFormInternalValues),
		onSubmit: ({ value }) => {
			const common = {
				sessionDate: value.sessionDate,
				startTime: value.startTime,
				endTime: value.endTime,
				breakMinutes: value.breakMinutes,
				tagIds: value.tagIds,
				memo: value.memo,
				storeId: value.storeId,
				currencyId: value.currencyId,
			};

			if (value.sessionType === "cash_game") {
				const anteType = value.anteType ?? "none";
				onSubmit({
					...common,
					type: "cash_game",
					buyIn: value.buyIn,
					cashOut: value.cashOut,
					evCashOut: value.evCashOut,
					variant: value.variant,
					blind1: value.blind1,
					blind2: value.blind2,
					blind3: value.blind3,
					anteType: anteType !== "none" ? anteType : undefined,
					ante: anteType !== "none" ? value.ante : undefined,
					tableSize: value.tableSize,
					ringGameId: value.ringGameId,
				});
			} else {
				onSubmit({
					...common,
					type: "tournament",
					tournamentBuyIn: value.tournamentBuyIn,
					entryFee: value.entryFee,
					placement: value.placement,
					totalEntries: value.totalEntries,
					prizeMoney: value.prizeMoney,
					rebuyCount: value.rebuyCount,
					rebuyCost: value.rebuyCost,
					addonCost: value.addonCost,
					bountyPrizes: value.bountyPrizes,
					tournamentId: value.tournamentId,
				});
			}
		},
		validators: {
			onSubmit: sessionFormSchema,
		},
	});

	const sessionType = form.useStore((s) => {
		const v = s.values;
		return v.sessionType;
	});
	const isCashGame = sessionType === "cash_game";
	const gameOptions = isCashGame ? ringGames : tournaments;

	const handleSessionTypeChange = (value: string) => {
		const newType = value as "cash_game" | "tournament";
		if (newType === sessionType) return;

		const current = form.getFieldValue("sessionDate" as never) as string;
		const currentStartTime = form.getFieldValue("startTime" as never) as
			| string
			| undefined;
		const currentEndTime = form.getFieldValue("endTime" as never) as
			| string
			| undefined;
		const currentBreakMinutes = form.getFieldValue("breakMinutes" as never) as
			| number
			| undefined;
		const currentStoreId = form.getFieldValue("storeId" as never) as
			| string
			| undefined;
		const currentTagIds = form.getFieldValue("tagIds" as never) as string[];
		const currentMemo = form.getFieldValue("memo" as never) as
			| string
			| undefined;
		const currentCurrencyId = form.getFieldValue("currencyId" as never) as
			| string
			| undefined;

		if (newType === "cash_game") {
			form.reset({
				sessionType: "cash_game",
				sessionDate: current ?? getTodayDateString(),
				startTime: currentStartTime,
				endTime: currentEndTime,
				breakMinutes: currentBreakMinutes,
				storeId: currentStoreId,
				ringGameId: undefined,
				buyIn: 0,
				cashOut: 0,
				evCashOut: undefined,
				variant: "nlh",
				blind1: undefined,
				blind2: undefined,
				blind3: undefined,
				anteType: "none",
				ante: undefined,
				tableSize: undefined,
				currencyId: currentCurrencyId,
				tagIds: currentTagIds ?? [],
				memo: currentMemo,
			});
		} else {
			form.reset({
				sessionType: "tournament",
				sessionDate: current ?? getTodayDateString(),
				startTime: currentStartTime,
				endTime: currentEndTime,
				breakMinutes: currentBreakMinutes,
				storeId: currentStoreId,
				tournamentId: undefined,
				tournamentBuyIn: 0,
				entryFee: undefined,
				placement: undefined,
				totalEntries: undefined,
				prizeMoney: undefined,
				rebuyCount: undefined,
				rebuyCost: undefined,
				addonCost: undefined,
				bountyPrizes: undefined,
				currencyId: currentCurrencyId,
				tagIds: currentTagIds ?? [],
				memo: currentMemo,
			});
		}
	};

	const handleStoreChange = (value: string) => {
		const storeId = value === NONE_VALUE ? undefined : value;
		form.setFieldValue("storeId" as never, storeId as never);
		// Clear game selection when store changes
		if (isCashGame) {
			form.setFieldValue("ringGameId" as never, undefined as never);
		} else {
			form.setFieldValue("tournamentId" as never, undefined as never);
		}
		onStoreChange?.(storeId);
	};

	const handleGameChange = (value: string) => {
		const gameId = value === NONE_VALUE ? undefined : value;

		if (isCashGame) {
			form.setFieldValue("ringGameId" as never, gameId as never);

			// Auto-fill fields from ring game
			if (ringGames && gameId) {
				const game = ringGames.find((g) => g.id === gameId);
				if (game) {
					if (game.variant != null) {
						form.setFieldValue("variant" as never, game.variant as never);
					}
					form.setFieldValue(
						"blind1" as never,
						nullToUndefined(game.blind1) as never
					);
					form.setFieldValue(
						"blind2" as never,
						nullToUndefined(game.blind2) as never
					);
					form.setFieldValue(
						"blind3" as never,
						nullToUndefined(game.blind3) as never
					);
					form.setFieldValue(
						"ante" as never,
						nullToUndefined(game.ante) as never
					);
					form.setFieldValue(
						"anteType" as never,
						(nullToUndefined(game.anteType) ?? "none") as never
					);
					form.setFieldValue(
						"tableSize" as never,
						nullToUndefined(game.tableSize) as never
					);
					if (game.currencyId) {
						form.setFieldValue(
							"currencyId" as never,
							game.currencyId as never
						);
					}
				}
			}
		} else {
			form.setFieldValue("tournamentId" as never, gameId as never);

			// Auto-fill fields from tournament
			if (tournaments && gameId) {
				const game = tournaments.find((t) => t.id === gameId);
				if (game) {
					if (game.buyIn != null) {
						form.setFieldValue(
							"tournamentBuyIn" as never,
							game.buyIn as never
						);
					}
					if (game.entryFee != null) {
						form.setFieldValue(
							"entryFee" as never,
							game.entryFee as never
						);
					}
				}
			}
		}
	};

	const gameLabel = isCashGame ? "Cash Game" : "Tournament";

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			{/* Session Type */}
			<Field label="Session Type">
				<Tabs onValueChange={handleSessionTypeChange} value={sessionType}>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="cash_game">Cash Game</TabsTrigger>
						<TabsTrigger value="tournament">Tournament</TabsTrigger>
					</TabsList>
				</Tabs>
			</Field>

			<SessionFormFields
				currencies={currencies}
				form={form}
				gameLabel={gameLabel}
				gameOptions={gameOptions}
				handleGameChange={handleGameChange}
				handleStoreChange={handleStoreChange}
				isCashGame={isCashGame}
				onCreateTag={onCreateTag}
				stores={stores}
				tags={tags}
			/>

			<form.Subscribe>
				{(state) => (
					<Button
						className="mt-2"
						disabled={isLoading || !state.canSubmit || state.isSubmitting}
						type="submit"
					>
						{isLoading || state.isSubmitting ? "Saving..." : "Save"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
