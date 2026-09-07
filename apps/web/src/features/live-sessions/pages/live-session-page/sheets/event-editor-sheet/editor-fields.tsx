import { IconRefresh, IconStackPush } from "@tabler/icons-react";
import { computeAllInEv } from "@/features/live-sessions/utils/live-session-summary";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { formatNumber, formatSignedNumber } from "@/utils/format-number";
import { plToneClass } from "../../cryst-tone";
import type { PlayerPickerCandidate } from "../../player-picker";
import { PlayerPicker } from "../../player-picker";
import type {
	ChipPurchaseOption,
	useEventEditorSheet,
} from "./use-event-editor-sheet";

type EditorForm = ReturnType<typeof useEventEditorSheet>["form"];

const INPUT_CLASS =
	"h-[var(--m-control)] w-full rounded-md border border-input bg-background px-2.5 text-[length:var(--m-text-secondary)] outline-none focus-visible:border-primary disabled:opacity-50 aria-invalid:border-destructive";

const NUMERIC_CLASS = `${INPUT_CLASS} font-mono tabular-nums`;

function fieldId(name: string) {
	return `cryst-event-${name}`;
}

const SPAN = {
	2: "col-span-2",
	3: "col-span-3",
	6: "col-span-6",
} as const;

export function NumericField({
	form,
	label,
	name,
	span = 6,
}: {
	form: EditorForm;
	label: string;
	name:
		| "amount"
		| "buyInAmount"
		| "equity"
		| "potSize"
		| "remainingPlayers"
		| "stackAmount"
		| "totalEntries"
		| "trials"
		| "wins";
	span?: 2 | 3 | 6;
}) {
	const isRequired = name !== "remainingPlayers" && name !== "totalEntries";
	return (
		<form.Field name={name}>
			{(field) => (
				<Field
					className={`${SPAN[span]} min-w-0 gap-1.5`}
					error={field.state.meta.errors[0]?.message}
					htmlFor={fieldId(field.name)}
					label={label}
					required={isRequired}
				>
					<input
						className={NUMERIC_CLASS}
						id={fieldId(field.name)}
						{...NO_INPUT_SUGGESTIONS}
						inputMode="numeric"
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						type="text"
						value={field.state.value}
					/>
				</Field>
			)}
		</form.Field>
	);
}

export function StackFields({
	form,
	isTournament,
}: {
	form: EditorForm;
	isTournament: boolean;
}) {
	return (
		<>
			<NumericField form={form} label="Stack" name="stackAmount" />
			{isTournament ? (
				<>
					<NumericField
						form={form}
						label="Players left"
						name="remainingPlayers"
						span={3}
					/>
					<NumericField
						form={form}
						label="Total entries"
						name="totalEntries"
						span={3}
					/>
				</>
			) : null}
		</>
	);
}

function formatSubtrahend(value: number): string {
	const rounded = Math.round(value);
	return rounded === 0 ? formatNumber(0) : `−${formatNumber(rounded)}`;
}

function AllInSummary({ form }: { form: EditorForm }) {
	return (
		<form.Subscribe
			selector={(state) => ({
				equity: state.values.equity,
				potSize: state.values.potSize,
				trials: state.values.trials,
				wins: state.values.wins,
			})}
		>
			{(values) => {
				const potSize = Number(values.potSize);
				const equity = Number(values.equity);
				const trials = Number(values.trials);
				const wins = Number(values.wins);
				const isComplete =
					Number.isFinite(potSize) &&
					Number.isFinite(equity) &&
					Number.isFinite(trials) &&
					Number.isFinite(wins) &&
					values.potSize !== "" &&
					values.equity !== "" &&
					values.trials !== "" &&
					values.wins !== "";
				const ev = isComplete
					? computeAllInEv({ equity, potSize, trials, wins })
					: null;
				return (
					<dl className="col-span-6 flex flex-col gap-1 rounded-md bg-muted px-3 py-2.5 text-[length:var(--text-xs)]">
						<div className="flex justify-between gap-3">
							<dt className="text-muted-foreground">
								Expected ({values.potSize || "—"} × {values.equity || "—"}%)
							</dt>
							<dd className="font-mono tabular-nums">
								{ev === null
									? "—"
									: formatSignedNumber(Math.round(ev.expected))}
							</dd>
						</div>
						<div className="flex justify-between gap-3">
							<dt className="text-muted-foreground">
								Realized ({values.potSize || "—"} ÷ {values.trials || "—"} ×{" "}
								{values.wins || "—"} won)
							</dt>
							<dd className="font-mono tabular-nums">
								{ev === null ? "—" : formatSubtrahend(ev.realized)}
							</dd>
						</div>
						<div className="flex justify-between gap-3 border-border border-t pt-1">
							<dt className="font-semibold">EV delta</dt>
							<dd
								className={cn(
									"font-mono tabular-nums",
									ev === null ? "" : plToneClass(ev.evDelta)
								)}
							>
								{ev === null ? "—" : formatSignedNumber(Math.round(ev.evDelta))}
							</dd>
						</div>
					</dl>
				);
			}}
		</form.Subscribe>
	);
}

export function AllInFields({ form }: { form: EditorForm }) {
	return (
		<>
			<NumericField form={form} label="Pot" name="potSize" />
			<NumericField form={form} label="Equity %" name="equity" span={2} />
			<NumericField form={form} label="Runs" name="trials" span={2} />
			<NumericField form={form} label="Wins" name="wins" span={2} />
			<AllInSummary form={form} />
		</>
	);
}

export function ChipsFields({ form }: { form: EditorForm }) {
	return (
		<>
			<NumericField form={form} label="Amount" name="amount" />
			<form.Field name="direction">
				{(field) => (
					<fieldset className="col-span-6 min-w-0">
						<legend className="mb-1.5 font-medium text-[length:var(--text-sm)]">
							Direction
						</legend>
						<div className="grid grid-cols-2 gap-1.5">
							{(
								[
									{ label: "Add chips (+)", value: "add" },
									{ label: "Withdraw (−)", value: "remove" },
								] as const
							).map((option) => (
								<button
									aria-pressed={field.state.value === option.value}
									className={cn(
										"h-[var(--m-control)] rounded-full border font-semibold text-[length:var(--text-sm)]",
										field.state.value === option.value
											? "border-primary bg-primary text-primary-foreground"
											: "border-border bg-transparent text-foreground"
									)}
									key={option.value}
									onClick={() => field.handleChange(option.value)}
									type="button"
								>
									{option.label}
								</button>
							))}
						</div>
					</fieldset>
				)}
			</form.Field>
		</>
	);
}

export function MemoFields({ form }: { form: EditorForm }) {
	return (
		<form.Field name="memoText">
			{(field) => (
				<Field
					className="col-span-6 min-w-0 gap-1.5"
					error={field.state.meta.errors[0]?.message}
					htmlFor={fieldId(field.name)}
					label="Note"
					required
				>
					<textarea
						className="min-h-[88px] w-full resize-none rounded-lg border border-input bg-card px-3 py-2.5 text-[length:var(--m-text-secondary)] outline-none focus-visible:border-primary aria-invalid:border-destructive"
						id={fieldId(field.name)}
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						value={field.state.value}
					/>
				</Field>
			)}
		</form.Field>
	);
}

const PURCHASE_ICONS = [IconRefresh, IconStackPush] as const;

export function PurchaseFields({
	form,
	options,
}: {
	form: EditorForm;
	options: ChipPurchaseOption[];
}) {
	return (
		<form.Field name="purchaseId">
			{(field) => (
				<Field
					className="col-span-6 min-w-0 gap-1.5"
					error={field.state.meta.errors[0]?.message}
					label="Purchase option"
					required
				>
					{options.length === 0 ? (
						<p className="text-[length:var(--text-xs)] text-muted-foreground">
							No purchase options are configured for this tournament.
						</p>
					) : (
						<div className="flex flex-col gap-1.5">
							{options.map((option, index) => {
								const isSelected = field.state.value === option.id;
								const OptionIcon =
									PURCHASE_ICONS[index % PURCHASE_ICONS.length] ?? IconRefresh;
								return (
									<button
										aria-pressed={isSelected}
										className={cn(
											"flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left",
											isSelected
												? "border-primary bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]"
												: "border-border bg-transparent"
										)}
										key={option.id}
										onClick={() => field.handleChange(option.id)}
										type="button"
									>
										<OptionIcon
											className={
												isSelected ? "text-primary" : "text-muted-foreground"
											}
											size={16}
										/>
										<span className="min-w-0 flex-1">
											<span className="block font-semibold text-[length:var(--text-sm)]">
												{option.name}
											</span>
											<span className="block text-[11px] text-muted-foreground">
												{formatSignedNumber(option.chips)} chips
											</span>
										</span>
										<span className="font-mono text-[length:var(--text-sm)] tabular-nums">
											{formatNumber(option.cost)}
										</span>
									</button>
								);
							})}
						</div>
					)}
				</Field>
			)}
		</form.Field>
	);
}

export function SeatFields({
	form,
	isHeroSeatEvent,
	isSeatEditable,
	onPlayerQueryChange,
	playerCandidates,
	playerQuery,
}: {
	form: EditorForm;
	isHeroSeatEvent: boolean;
	isSeatEditable: boolean;
	onPlayerQueryChange: (value: string) => void;
	playerCandidates: readonly PlayerPickerCandidate[];
	playerQuery: string;
}) {
	return (
		<>
			<form.Field name="seatNumber">
				{(field) => (
					<Field
						className="col-span-2 min-w-0 gap-1.5"
						error={field.state.meta.errors[0]?.message}
						htmlFor={fieldId(field.name)}
						label="Seat"
						required={isSeatEditable}
					>
						<input
							className={NUMERIC_CLASS}
							disabled={!isSeatEditable}
							id={fieldId(field.name)}
							{...NO_INPUT_SUGGESTIONS}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="playerId">
				{(field) => (
					<Field
						className="col-span-4 min-w-0 gap-1.5"
						error={field.state.meta.errors[0]?.message}
						label="Player"
						required={isSeatEditable}
					>
						{isSeatEditable ? (
							<PlayerPicker
								candidates={playerCandidates}
								emptyLabel="No player matches"
								onPick={(candidate) => field.handleChange(candidate.key)}
								onQueryChange={onPlayerQueryChange}
								pickedKey={field.state.value === "" ? null : field.state.value}
								query={playerQuery}
								searchLabel="Search players by name"
							/>
						) : (
							<p className={`${INPUT_CLASS} flex items-center opacity-50`}>
								{isHeroSeatEvent ? "You" : "Set from the table"}
							</p>
						)}
					</Field>
				)}
			</form.Field>
		</>
	);
}

export function StartFields({
	form,
	isTournament,
}: {
	form: EditorForm;
	isTournament: boolean;
}) {
	if (!isTournament) {
		return <NumericField form={form} label="Buy-in" name="buyInAmount" />;
	}
	return (
		<form.Field name="timerStart">
			{(field) => (
				<Field
					className="col-span-6 min-w-0 gap-1.5"
					error={field.state.meta.errors[0]?.message}
					htmlFor={fieldId(field.name)}
					label="Timer start"
				>
					<input
						className={NUMERIC_CLASS}
						id={fieldId(field.name)}
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						type="time"
						value={field.state.value}
					/>
				</Field>
			)}
		</form.Field>
	);
}

export function TimeField({
	form,
	timeValidator,
}: {
	form: EditorForm;
	timeValidator: (value: string) => string | undefined;
}) {
	return (
		<form.Field
			name="time"
			validators={{ onChange: ({ value }) => timeValidator(value) }}
		>
			{(field) => (
				<Field
					className="col-span-6 min-w-0 gap-1.5"
					error={field.state.meta.errors[0]?.toString()}
					htmlFor={fieldId(field.name)}
					label="Time"
					required
				>
					<input
						className={NUMERIC_CLASS}
						id={fieldId(field.name)}
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						type="time"
						value={field.state.value}
					/>
				</Field>
			)}
		</form.Field>
	);
}
