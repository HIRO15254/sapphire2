import {
	IconCheck,
	IconChevronLeft,
	IconChevronRight,
} from "@tabler/icons-react";
import type {
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { TagInput } from "@/shared/components/ui/tag-input";
import { Textarea } from "@/shared/components/ui/textarea";
import { CashGameFields } from "../cash-game-fields";
import { StoreGameSelectors } from "../link-selectors";
import {
	TournamentResultFields,
	TournamentRuleFields,
} from "../tournament-fields";
import { BlindLevelsInlineTable } from "./blind-levels-inline-table";
import { ChipPurchasesInlineTable } from "./chip-purchases-inline-table";
import {
	type UseSessionWizardReturn,
	useSessionWizard,
	type WizardMode,
	type WizardStep,
} from "./use-session-wizard";

export type {
	CashGameFormValues,
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

interface SessionWizardProps {
	currencies?: Array<{ id: string; name: string }>;
	defaultValues?: SessionFormDefaults;
	isLiveLinked?: boolean;
	isLoading?: boolean;
	/**
	 * "manual" (default) renders all three steps and submits to
	 * session.create / session.update. "live" drops the Result step
	 * (because live sessions populate results from events) and labels
	 * the final action "Start session" — the caller still receives the
	 * accumulated form values via `onSubmit`.
	 */
	mode?: WizardMode;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onStoreChange?: (storeId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	stores?: Array<{ id: string; name: string }>;
	submitLabel?: string;
	tags?: Array<{ id: string; name: string }>;
	tournaments?: TournamentOption[];
}

function stepVariant(
	isActive: boolean,
	isDone: boolean
): "default" | "secondary" | "outline" {
	if (isActive) {
		return "default";
	}
	if (isDone) {
		return "secondary";
	}
	return "outline";
}

function StepperBar({
	currentStep,
	steps,
}: {
	currentStep: WizardStep;
	steps: ReadonlyArray<{ key: WizardStep; label: string }>;
}) {
	return (
		<div className="flex items-center gap-2">
			{steps.map((step, idx) => {
				const stepIdx = steps.findIndex((s) => s.key === currentStep);
				const isActive = step.key === currentStep;
				const isDone = idx < stepIdx;
				return (
					<div className="flex items-center gap-2" key={step.key}>
						<Badge
							className="h-6 w-6 justify-center p-0"
							variant={stepVariant(isActive, isDone)}
						>
							{isDone ? <IconCheck size={12} /> : idx + 1}
						</Badge>
						<span
							className={
								isActive
									? "font-medium text-sm"
									: "text-muted-foreground text-sm"
							}
						>
							{step.label}
						</span>
						{idx < steps.length - 1 && (
							<span className="mx-1 text-muted-foreground">/</span>
						)}
					</div>
				);
			})}
		</div>
	);
}

function MasterStepBody({
	state,
	stores,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	stores?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
}) {
	return (
		<>
			<Field label="Session Type">
				<Tabs
					onValueChange={(value) =>
						state.setSessionType(value as "cash_game" | "tournament")
					}
					value={state.sessionType}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger disabled={isLiveLinked} value="cash_game">
							Cash Game
						</TabsTrigger>
						<TabsTrigger disabled={isLiveLinked} value="tournament">
							Tournament
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</Field>
			<StoreGameSelectors
				gameLabel={state.gameLabel}
				gameOptions={state.gameOptions}
				isLiveLinked={isLiveLinked}
				onGameChange={state.handleGameChange}
				onStoreChange={state.handleStoreChange}
				selectedGameId={state.selectedGameId}
				selectedStoreId={state.selectedStoreId}
				stores={stores}
			/>
			<p className="text-muted-foreground text-xs">
				Pick the master rule for this session. The rules in the next step are
				pre-filled from your selection; you can override them per session. Leave
				blank to define the rule from scratch.
			</p>
		</>
	);
}

function RuleNameField({
	state,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
}) {
	return (
		<state.form.Field name="ruleName">
			{(field) => (
				<Field htmlFor={field.name} label="Rule Name">
					<Input
						disabled={isLiveLinked}
						id={field.name}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						value={field.state.value}
					/>
				</Field>
			)}
		</state.form.Field>
	);
}

function CashBuyInBoundsFields({
	state,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
}) {
	const { form } = state;
	return (
		<div className="grid grid-cols-2 gap-3">
			<form.Field name="minBuyIn">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Min Buy-in"
					>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="maxBuyIn">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Max Buy-in"
					>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</div>
	);
}

function TournamentSnapshotScalarFields({
	state,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
}) {
	const { form } = state;
	return (
		<div className="grid grid-cols-2 gap-3">
			<form.Field name="startingStack">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Starting Stack"
					>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="bountyAmount">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Bounty Amount"
					>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</div>
	);
}

function CashRulesStepBody({
	state,
	currencies,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
}) {
	return (
		<>
			<RuleNameField isLiveLinked={isLiveLinked} state={state} />
			<CashGameFields
				currencies={currencies}
				form={state.form}
				isLiveLinked={isLiveLinked}
				onCurrencyChange={state.setSelectedCurrencyId}
				selectedCurrencyId={state.selectedCurrencyId}
			/>
			<CashBuyInBoundsFields isLiveLinked={isLiveLinked} state={state} />
		</>
	);
}

function TournamentRulesStepBody({
	state,
	currencies,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
}) {
	return (
		<>
			<RuleNameField isLiveLinked={isLiveLinked} state={state} />
			<TournamentRuleFields
				currencies={currencies}
				form={state.form}
				isLiveLinked={isLiveLinked}
				key={`tourney-rule-${state.selectedGameId ?? "none"}`}
				onCurrencyChange={state.setSelectedCurrencyId}
				selectedCurrencyId={state.selectedCurrencyId}
			/>
			<TournamentSnapshotScalarFields
				isLiveLinked={isLiveLinked}
				state={state}
			/>
			<BlindLevelsInlineTable
				onChange={state.setBlindLevels}
				value={state.blindLevels}
			/>
			<ChipPurchasesInlineTable
				onChange={state.setChipPurchases}
				value={state.chipPurchases}
			/>
		</>
	);
}

function RulesStepBody({
	state,
	currencies,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
}) {
	if (state.isCashGame) {
		return (
			<CashRulesStepBody
				currencies={currencies}
				isLiveLinked={isLiveLinked}
				state={state}
			/>
		);
	}
	return (
		<TournamentRulesStepBody
			currencies={currencies}
			isLiveLinked={isLiveLinked}
			state={state}
		/>
	);
}

function DateTimeFields({
	state,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
}) {
	const { form } = state;
	return (
		<>
			<form.Field name="sessionDate">
				{(field) => (
					<Field htmlFor={field.name} label="Session Date" required>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							type="date"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="startTime">
					{(field) => (
						<Field htmlFor={field.name} label="Start Time">
							<Input
								disabled={isLiveLinked}
								id={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="time"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="endTime">
					{(field) => (
						<Field htmlFor={field.name} label="End Time">
							<Input
								disabled={isLiveLinked}
								id={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="time"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>
			<form.Field name="breakMinutes">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Break Time (min)"
					>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</>
	);
}

function CashResultFields({
	state,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
}) {
	const { form } = state;
	return (
		<>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="buyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Buy-in"
							required
						>
							<Input
								disabled={isLiveLinked}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="cashOut">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Cash-out"
							required
						>
							<Input
								disabled={isLiveLinked}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>
			<form.Field name="evCashOut">
				{(field) => (
					<Field htmlFor={field.name} label="EV Cash-out">
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</>
	);
}

function TagsAndMemo({
	state,
	tags,
	onCreateTag,
}: {
	state: UseSessionWizardReturn;
	tags?: Array<{ id: string; name: string }>;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
}) {
	return (
		<>
			<Field label="Session Tags">
				<TagInput
					availableTags={tags}
					onAdd={(tag) => state.setSelectedTagIds((prev) => [...prev, tag.id])}
					onCreateTag={onCreateTag}
					onRemove={(tag) =>
						state.setSelectedTagIds((prev) =>
							prev.filter((id) => id !== tag.id)
						)
					}
					selectedTags={state.selectedTagIds
						.map((id) => tags?.find((t) => t.id === id))
						.filter((t): t is { id: string; name: string } => t !== undefined)}
				/>
			</Field>
			<state.form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</state.form.Field>
		</>
	);
}

function CashStartStepBody({ state }: { state: UseSessionWizardReturn }) {
	const { form } = state;
	return (
		<>
			<form.Field name="buyIn">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Initial Buy-in"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<p className="text-muted-foreground text-xs">
				The amount you sit down with. It is recorded as the session-start event;
				later buy-ins are added from the live scene.
			</p>
		</>
	);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline justify-between gap-4 py-1">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="text-right font-medium text-sm">{value}</span>
		</div>
	);
}

function TournamentStartSummary({ state }: { state: UseSessionWizardReturn }) {
	return (
		<state.form.Subscribe
			selector={(s) => ({
				buyIn: s.values.tournamentBuyIn,
				entryFee: s.values.entryFee,
				startingStack: s.values.startingStack,
			})}
		>
			{({ buyIn, entryFee, startingStack }) => (
				<div className="flex flex-col gap-2">
					<div className="rounded-md border p-3">
						<SummaryRow label="Buy-in" value={buyIn || "—"} />
						<SummaryRow label="Entry Fee" value={entryFee || "—"} />
						<SummaryRow label="Starting Stack" value={startingStack || "—"} />
					</div>
					{startingStack ? (
						<p className="text-muted-foreground text-xs">
							The starting stack is recorded as your stack at kickoff.
						</p>
					) : (
						<p className="text-destructive text-xs">
							Set a starting stack on the Rules step before starting the
							session.
						</p>
					)}
				</div>
			)}
		</state.form.Subscribe>
	);
}

function StartStepBody({ state }: { state: UseSessionWizardReturn }) {
	return state.isCashGame ? (
		<CashStartStepBody state={state} />
	) : (
		<TournamentStartSummary state={state} />
	);
}

function ResultStepBody({
	state,
	tags,
	onCreateTag,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	tags?: Array<{ id: string; name: string }>;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	isLiveLinked: boolean;
}) {
	return (
		<>
			<DateTimeFields isLiveLinked={isLiveLinked} state={state} />
			{state.isCashGame ? (
				<CashResultFields isLiveLinked={isLiveLinked} state={state} />
			) : (
				<TournamentResultFields form={state.form} isLiveLinked={isLiveLinked} />
			)}
			<TagsAndMemo onCreateTag={onCreateTag} state={state} tags={tags} />
		</>
	);
}

export function SessionWizard({
	currencies,
	defaultValues,
	isLiveLinked = false,
	isLoading = false,
	mode = "manual",
	onCreateTag,
	onStoreChange,
	onSubmit,
	ringGames,
	stores,
	submitLabel,
	tags,
	tournaments,
}: SessionWizardProps) {
	const state = useSessionWizard({
		defaultValues,
		mode,
		onStoreChange,
		onSubmit,
		ringGames,
		tournaments,
	});
	const finalSubmitLabel = submitLabel ?? (mode === "live" ? "Start" : "Save");

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				state.form.handleSubmit();
			}}
		>
			{isLiveLinked && (
				<Alert data-testid="live-linked-banner">
					<AlertDescription>
						This session is generated from a live session. Items calculated from
						event history cannot be edited. To modify, edit the events in the
						live session.
					</AlertDescription>
				</Alert>
			)}

			<StepperBar currentStep={state.currentStep} steps={state.steps} />

			<div className="flex flex-col gap-3">
				{state.currentStep === "master" && (
					<MasterStepBody
						isLiveLinked={isLiveLinked}
						state={state}
						stores={stores}
					/>
				)}
				{state.currentStep === "rules" && (
					<RulesStepBody
						currencies={currencies}
						isLiveLinked={isLiveLinked}
						state={state}
					/>
				)}
				{state.currentStep === "result" && (
					<ResultStepBody
						isLiveLinked={isLiveLinked}
						onCreateTag={onCreateTag}
						state={state}
						tags={tags}
					/>
				)}
				{state.currentStep === "start" && <StartStepBody state={state} />}
			</div>

			<div className="mt-2 flex items-center justify-between gap-2">
				<Button
					disabled={state.isFirstStep}
					onClick={state.goToPrev}
					type="button"
					variant="outline"
				>
					<IconChevronLeft size={14} />
					Back
				</Button>
				{state.isLastStep ? (
					<state.form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
						{([canSubmit, isSubmitting]) => (
							<Button
								disabled={isLoading || !canSubmit || isSubmitting}
								type="submit"
							>
								{isLoading ? `${finalSubmitLabel}...` : finalSubmitLabel}
							</Button>
						)}
					</state.form.Subscribe>
				) : (
					<Button onClick={state.goToNext} type="button">
						Next
						<IconChevronRight size={14} />
					</Button>
				)}
			</div>
		</form>
	);
}
