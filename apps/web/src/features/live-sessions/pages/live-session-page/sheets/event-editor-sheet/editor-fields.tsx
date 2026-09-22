import { IconRefresh, IconStackPush } from "@tabler/icons-react";
import { computeAllInEv } from "@/features/live-sessions/utils/live-session-summary";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { formatNumber, formatSignedNumber } from "@/utils/format-number";
import { CRYST_FIELD } from "../../cryst-controls";
import { plToneClass } from "../../cryst-tone";
import { RadioCard, RadioCardGroup } from "../../radio-card";
import { SegmentedControl } from "../../segmented-control";
import type {
	ChipPurchaseOption,
	useEventEditorSheet,
} from "./use-event-editor-sheet";

type EditorForm = ReturnType<typeof useEventEditorSheet>["form"];

const INPUT_CLASS = `${CRYST_FIELD} h-[var(--m-control)] w-full px-2.5`;

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

const DIRECTION_OPTIONS = [
	{ label: "Add chips (+)", value: "add" },
	{ label: "Withdraw (−)", value: "remove" },
] as const;

export function ChipsFields({ form }: { form: EditorForm }) {
	return (
		<>
			<NumericField form={form} label="Amount" name="amount" />
			<form.Field name="direction">
				{(field) => (
					<div className="col-span-6 min-w-0">
						<span
							className="mb-1.5 block font-medium text-[length:var(--text-sm)]"
							id={fieldId("direction")}
						>
							Direction
						</span>
						<SegmentedControl
							aria-labelledby={fieldId("direction")}
							onChange={field.handleChange}
							options={DIRECTION_OPTIONS}
							value={field.state.value}
						/>
					</div>
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
						className={cn(
							CRYST_FIELD,
							"min-h-[88px] w-full resize-none px-3 py-2.5 leading-normal"
						)}
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
						<RadioCardGroup
							aria-label="Purchase option"
							onValueChange={field.handleChange}
							value={field.state.value}
						>
							{options.map((option, index) => (
								<RadioCard
									description={`${formatSignedNumber(option.chips)} chips`}
									icon={
										PURCHASE_ICONS[index % PURCHASE_ICONS.length] ?? IconRefresh
									}
									key={option.id}
									meta={formatNumber(option.cost)}
									title={option.name}
									value={option.id}
								/>
							))}
						</RadioCardGroup>
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
}: {
	form: EditorForm;
	isHeroSeatEvent: boolean;
	isSeatEditable: boolean;
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
			<Field className="col-span-4 min-w-0 gap-1.5" label="Player">
				<p className={`${INPUT_CLASS} flex items-center opacity-50`}>
					{isHeroSeatEvent ? "You" : "Set from the table"}
				</p>
			</Field>
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
