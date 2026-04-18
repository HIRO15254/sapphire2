import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { TagInput } from "@/shared/components/ui/tag-input";
import { Textarea } from "@/shared/components/ui/textarea";
import { optionalNumericString } from "@/shared/lib/form-fields";
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
	endedBeforeRegistrationClose?: boolean;
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
	endedBeforeRegistrationClose?: boolean;
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

function numStrOrEmpty(value: number | undefined): string {
	return value === undefined ? "" : String(value);
}

function parseOptInt(value: string): number | undefined {
	if (value === "") {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

const NONE_VALUE = "__none__";

const sessionFormSchema = z.object({
	sessionDate: z.string().min(1, "Date is required"),
	startTime: z.string(),
	endTime: z.string(),
	breakMinutes: optionalNumericString({ integer: true, min: 0 }),
	memo: z.string(),
	buyIn: optionalNumericString({ integer: true, min: 0 }),
	cashOut: optionalNumericString({ integer: true, min: 0 }),
	evCashOut: optionalNumericString({ integer: true, min: 0 }),
	variant: z.string(),
	blind1: optionalNumericString({ integer: true, min: 0 }),
	blind2: optionalNumericString({ integer: true, min: 0 }),
	blind3: optionalNumericString({ integer: true, min: 0 }),
	ante: optionalNumericString({ integer: true, min: 0 }),
	anteType: z.string(),
	tableSize: z.string(),
	tournamentBuyIn: optionalNumericString({ integer: true, min: 0 }),
	entryFee: optionalNumericString({ integer: true, min: 0 }),
	placement: optionalNumericString({ integer: true, min: 1 }),
	totalEntries: optionalNumericString({ integer: true, min: 1 }),
	prizeMoney: optionalNumericString({ integer: true, min: 0 }),
	rebuyCount: optionalNumericString({ integer: true, min: 0 }),
	rebuyCost: optionalNumericString({ integer: true, min: 0 }),
	addonCost: optionalNumericString({ integer: true, min: 0 }),
	bountyPrizes: optionalNumericString({ integer: true, min: 0 }),
	endedBeforeRegistrationClose: z.boolean(),
});

function buildDefaults(defaults: SessionFormDefaults | undefined) {
	return {
		sessionDate: defaults?.sessionDate ?? getTodayDateString(),
		startTime: defaults?.startTime ?? "",
		endTime: defaults?.endTime ?? "",
		breakMinutes: numStrOrEmpty(defaults?.breakMinutes),
		memo: defaults?.memo ?? "",
		buyIn: numStrOrEmpty(defaults?.buyIn),
		cashOut: numStrOrEmpty(defaults?.cashOut),
		evCashOut: numStrOrEmpty(defaults?.evCashOut),
		variant: defaults?.variant ?? "nlh",
		blind1: numStrOrEmpty(defaults?.blind1),
		blind2: numStrOrEmpty(defaults?.blind2),
		blind3: numStrOrEmpty(defaults?.blind3),
		ante: numStrOrEmpty(defaults?.ante),
		anteType: defaults?.anteType ?? "none",
		tableSize: defaults?.tableSize?.toString() ?? "",
		tournamentBuyIn: numStrOrEmpty(defaults?.tournamentBuyIn),
		entryFee: numStrOrEmpty(defaults?.entryFee),
		placement: numStrOrEmpty(defaults?.placement),
		totalEntries: numStrOrEmpty(defaults?.totalEntries),
		prizeMoney: numStrOrEmpty(defaults?.prizeMoney),
		rebuyCount: numStrOrEmpty(defaults?.rebuyCount),
		rebuyCost: numStrOrEmpty(defaults?.rebuyCost),
		addonCost: numStrOrEmpty(defaults?.addonCost),
		bountyPrizes: numStrOrEmpty(defaults?.bountyPrizes),
		endedBeforeRegistrationClose:
			defaults?.endedBeforeRegistrationClose ?? false,
	};
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
	const [sessionType, setSessionType] = useState<"cash_game" | "tournament">(
		defaultValues?.type ?? "cash_game"
	);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
		defaultValues?.tagIds ?? []
	);
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		defaultValues?.storeId
	);
	const [selectedGameId, setSelectedGameId] = useState<string | undefined>(
		defaultValues?.ringGameId ?? defaultValues?.tournamentId
	);
	const [selectedCurrencyId, setSelectedCurrencyId] = useState<
		string | undefined
	>(defaultValues?.currencyId);

	const isCashGame = sessionType === "cash_game";
	const gameOptions = isCashGame ? ringGames : tournaments;

	const form = useForm({
		defaultValues: buildDefaults(defaultValues),
		onSubmit: ({ value }) => {
			const common = {
				sessionDate: value.sessionDate,
				startTime: value.startTime || undefined,
				endTime: value.endTime || undefined,
				breakMinutes: parseOptInt(value.breakMinutes),
				tagIds: selectedTagIds,
				memo: value.memo || undefined,
				storeId: selectedStoreId,
				currencyId: selectedCurrencyId,
			};

			if (isCashGame) {
				onSubmit({
					...common,
					type: "cash_game",
					buyIn: Number(value.buyIn),
					cashOut: Number(value.cashOut),
					evCashOut: parseOptInt(value.evCashOut),
					variant: value.variant || "nlh",
					blind1: parseOptInt(value.blind1),
					blind2: parseOptInt(value.blind2),
					blind3: parseOptInt(value.blind3),
					ante: value.anteType === "none" ? undefined : parseOptInt(value.ante),
					anteType: value.anteType || undefined,
					tableSize: parseOptInt(value.tableSize),
					ringGameId: selectedGameId,
				});
			} else {
				const endedBeforeRegistrationClose =
					value.endedBeforeRegistrationClose === true;
				onSubmit({
					...common,
					type: "tournament",
					tournamentBuyIn: Number(value.tournamentBuyIn),
					entryFee: parseOptInt(value.entryFee),
					placement: endedBeforeRegistrationClose
						? undefined
						: parseOptInt(value.placement),
					totalEntries: endedBeforeRegistrationClose
						? undefined
						: parseOptInt(value.totalEntries),
					prizeMoney: parseOptInt(value.prizeMoney),
					rebuyCount: parseOptInt(value.rebuyCount),
					rebuyCost: parseOptInt(value.rebuyCost),
					addonCost: parseOptInt(value.addonCost),
					bountyPrizes: parseOptInt(value.bountyPrizes),
					endedBeforeRegistrationClose,
					tournamentId: selectedGameId,
				});
			}
		},
		validators: {
			onSubmit: sessionFormSchema,
		},
	});

	const applyOverrides = (
		overrides: Partial<ReturnType<typeof buildDefaults>>
	) => {
		for (const [key, value] of Object.entries(overrides)) {
			if (value !== undefined) {
				form.setFieldValue(
					key as keyof ReturnType<typeof buildDefaults>,
					value as string
				);
			}
		}
	};

	const handleStoreChange = (value: string) => {
		const storeId = value === NONE_VALUE ? undefined : value;
		setSelectedStoreId(storeId);
		setSelectedGameId(undefined);
		onStoreChange?.(storeId);
	};

	const applyRingGameDefaults = (gameId: string) => {
		const game = ringGames?.find((g) => g.id === gameId);
		if (!game) {
			return;
		}
		if (game.currencyId) {
			setSelectedCurrencyId(game.currencyId);
		}
		applyOverrides({
			variant: game.variant ?? undefined,
			blind1: numStrOrEmpty(game.blind1 ?? undefined),
			blind2: numStrOrEmpty(game.blind2 ?? undefined),
			blind3: numStrOrEmpty(game.blind3 ?? undefined),
			ante: numStrOrEmpty(game.ante ?? undefined),
			anteType: game.anteType ?? undefined,
			tableSize: game.tableSize?.toString() ?? undefined,
		});
	};

	const applyTournamentDefaults = (gameId: string) => {
		const game = tournaments?.find((t) => t.id === gameId);
		if (!game) {
			return;
		}
		applyOverrides({
			tournamentBuyIn: numStrOrEmpty(game.buyIn ?? undefined),
			entryFee: numStrOrEmpty(game.entryFee ?? undefined),
		});
	};

	const handleGameChange = (value: string) => {
		const gameId = value === NONE_VALUE ? undefined : value;
		setSelectedGameId(gameId);
		if (!gameId) {
			return;
		}
		if (isCashGame) {
			applyRingGameDefaults(gameId);
		} else {
			applyTournamentDefaults(gameId);
		}
	};

	const gameLabel = isCashGame ? "Cash Game" : "Tournament";

	const detailContent = isCashGame ? (
		<CashGameFields
			currencies={currencies}
			form={form}
			onCurrencyChange={setSelectedCurrencyId}
			selectedCurrencyId={selectedCurrencyId}
		/>
	) : (
		<TournamentDetailFields
			currencies={currencies}
			form={form}
			onCurrencyChange={setSelectedCurrencyId}
			selectedCurrencyId={selectedCurrencyId}
		/>
	);

	const tagsContent = (
		<>
			<Field label="Session Tags">
				<TagInput
					availableTags={tags}
					onAdd={(tag) => setSelectedTagIds((prev) => [...prev, tag.id])}
					onCreateTag={onCreateTag}
					onRemove={(tag) =>
						setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id))
					}
					selectedTags={selectedTagIds
						.map((id) => tags?.find((t) => t.id === id))
						.filter((t): t is { id: string; name: string } => t !== undefined)}
				/>
			</Field>
			<form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Notes about this session"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</>
	);

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<Field label="Session Type">
				<Tabs
					onValueChange={(value) =>
						setSessionType(value as "cash_game" | "tournament")
					}
					value={sessionType}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="cash_game">Cash Game</TabsTrigger>
						<TabsTrigger value="tournament">Tournament</TabsTrigger>
					</TabsList>
				</Tabs>
			</Field>

			<div className="flex flex-col gap-4">
				<form.Field name="sessionDate">
					{(field) => (
						<div className="flex flex-col gap-2">
							<Label htmlFor={field.name}>
								Session Date <span className="text-destructive">*</span>
							</Label>
							<Input
								id={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="date"
								value={field.state.value}
							/>
						</div>
					)}
				</form.Field>

				<div className="grid grid-cols-2 gap-3">
					<form.Field name="startTime">
						{(field) => (
							<div className="flex flex-col gap-2">
								<Label htmlFor={field.name}>Start Time</Label>
								<Input
									id={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="time"
									value={field.state.value}
								/>
							</div>
						)}
					</form.Field>
					<form.Field name="endTime">
						{(field) => (
							<div className="flex flex-col gap-2">
								<Label htmlFor={field.name}>End Time</Label>
								<Input
									id={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="time"
									value={field.state.value}
								/>
							</div>
						)}
					</form.Field>
				</div>

				<form.Field name="breakMinutes">
					{(field) => (
						<div className="flex flex-col gap-2">
							<Label htmlFor={field.name}>Break Time (min)</Label>
							<Input
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="0"
								value={field.state.value}
							/>
							{field.state.meta.errors[0] ? (
								<p className="text-destructive text-sm">
									{field.state.meta.errors[0]?.message}
								</p>
							) : null}
						</div>
					)}
				</form.Field>

				<StoreGameSelectors
					gameLabel={gameLabel}
					gameOptions={gameOptions}
					onGameChange={handleGameChange}
					onStoreChange={handleStoreChange}
					selectedGameId={selectedGameId}
					selectedStoreId={selectedStoreId}
					stores={stores}
				/>

				{isCashGame && (
					<>
						<div className="grid grid-cols-2 gap-3">
							<form.Field name="buyIn">
								{(field) => (
									<div className="flex flex-col gap-2">
										<Label htmlFor={field.name}>
											Buy-in <span className="text-destructive">*</span>
										</Label>
										<Input
											id={field.name}
											inputMode="numeric"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="0"
											value={field.state.value}
										/>
										{field.state.meta.errors[0] ? (
											<p className="text-destructive text-sm">
												{field.state.meta.errors[0]?.message}
											</p>
										) : null}
									</div>
								)}
							</form.Field>
							<form.Field name="cashOut">
								{(field) => (
									<div className="flex flex-col gap-2">
										<Label htmlFor={field.name}>
											Cash-out <span className="text-destructive">*</span>
										</Label>
										<Input
											id={field.name}
											inputMode="numeric"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="0"
											value={field.state.value}
										/>
										{field.state.meta.errors[0] ? (
											<p className="text-destructive text-sm">
												{field.state.meta.errors[0]?.message}
											</p>
										) : null}
									</div>
								)}
							</form.Field>
						</div>
						<form.Field name="evCashOut">
							{(field) => (
								<div className="flex flex-col gap-2">
									<Label htmlFor={field.name}>EV Cash-out</Label>
									<Input
										id={field.name}
										inputMode="numeric"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="0"
										value={field.state.value}
									/>
									<p className="text-muted-foreground text-xs">
										Expected value cash-out based on all-in equity. Leave empty
										if not tracking EV.
									</p>
								</div>
							)}
						</form.Field>
					</>
				)}

				{!isCashGame && (
					<TournamentPrimaryFields
						form={form}
						key={`tourney-primary-${selectedGameId ?? "none"}`}
					/>
				)}
			</div>

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

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, isSubmitting]) => (
					<Button
						className="mt-2"
						disabled={isLoading || !canSubmit || isSubmitting}
						type="submit"
					>
						{isLoading ? "Saving..." : "Save"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
