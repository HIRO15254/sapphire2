import { IconChevronRight } from "@tabler/icons-react";
import type { ChipPurchaseOption } from "@/features/live-sessions/pages/live-session-page/sheets/event-editor-sheet";
import {
	formatWithUnit,
	isMasterFieldDifferent,
	type MasterFieldValues,
} from "@/features/live-sessions/utils/session-settings";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import type { BlindSlotLabels } from "@/shared/hooks/use-game-groups";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { CRYST_FIELD, CRYST_FIELD_GROUP } from "../../cryst-controls";
import { SegmentedButtons } from "../../segmented-buttons";
import type { AnteType } from "./session-sheet-view";
import type { SessionForm } from "./use-session-sheet";

const ANTE_TYPES: { label: string; value: AnteType }[] = [
	{ label: "None", value: "none" },
	{ label: "BB", value: "bb" },
	{ label: "All", value: "all" },
];

const FIELD_LABEL_CLASS =
	"mb-1.5 block font-medium text-[length:var(--text-sm)] text-foreground";
const CONTROL_CLASS = `${CRYST_FIELD} box-border h-[var(--m-control)] w-full px-2.5`;
const NUMBER_CLASS = `${CONTROL_CLASS} font-mono`;

function fieldId(name: string) {
	return `cryst-session-${name}`;
}

function FieldLabel({
	isDifferent,
	label,
}: {
	isDifferent: boolean;
	label: string;
}) {
	if (!isDifferent) {
		return label;
	}
	return (
		<span className="inline-flex items-center gap-1.5">
			{label}
			<span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-info" />
			<span className="sr-only">(differs from master)</span>
		</span>
	);
}

type NumericFieldName =
	| "ante"
	| "blind1"
	| "blind2"
	| "blind3"
	| "bountyAmount"
	| "entryFee"
	| "maxBuyIn"
	| "minBuyIn"
	| "startingStack"
	| "tournamentBuyIn";

function NumericField({
	disabled = false,
	form,
	label,
	master,
	name,
	span = "col-span-2",
}: {
	disabled?: boolean;
	form: SessionForm;
	label: string;
	master: MasterFieldValues | null;
	name: NumericFieldName;
	span?: string;
}) {
	return (
		<form.Field name={name}>
			{(field) => (
				<Field
					className={cn(span, "min-w-0 gap-0")}
					error={field.state.meta.errors[0]?.message}
					htmlFor={fieldId(field.name)}
					label={
						<FieldLabel
							isDifferent={isMasterFieldDifferent(
								master,
								name,
								field.state.value
							)}
							label={label}
						/>
					}
				>
					<input
						{...NO_INPUT_SUGGESTIONS}
						className={cn(NUMBER_CLASS, "mt-1.5")}
						disabled={disabled}
						id={fieldId(field.name)}
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

const BUY_IN_ERROR_ID = "cryst-session-buyIn-error";

function BuyInRangeField({
	form,
	master,
}: {
	form: SessionForm;
	master: MasterFieldValues | null;
}) {
	return (
		<form.Field name="minBuyIn">
			{(minField) => (
				<form.Field name="maxBuyIn">
					{(maxField) => {
						const errorMessage =
							minField.state.meta.errors[0]?.message ??
							maxField.state.meta.errors[0]?.message;
						const hasError = errorMessage !== undefined;
						const isDifferent =
							isMasterFieldDifferent(
								master,
								"minBuyIn",
								minField.state.value
							) ||
							isMasterFieldDifferent(master, "maxBuyIn", maxField.state.value);
						return (
							<div className="col-span-4 min-w-0">
								<div className={FIELD_LABEL_CLASS}>
									<FieldLabel isDifferent={isDifferent} label="Buy-in" />
								</div>
								<div
									className={cn(
										CRYST_FIELD_GROUP,
										"mt-1.5 box-border flex h-[var(--m-control)] w-full items-center gap-1.5 px-2.5",
										hasError ? "border-destructive" : null
									)}
								>
									<input
										{...NO_INPUT_SUGGESTIONS}
										aria-describedby={hasError ? BUY_IN_ERROR_ID : undefined}
										aria-invalid={hasError}
										aria-label="Min buy-in"
										className="min-w-0 flex-1 bg-transparent font-mono outline-none"
										id={fieldId(minField.name)}
										inputMode="numeric"
										onBlur={minField.handleBlur}
										onChange={(e) => minField.handleChange(e.target.value)}
										type="text"
										value={minField.state.value}
									/>
									<span className="shrink-0 text-muted-foreground">–</span>
									<input
										{...NO_INPUT_SUGGESTIONS}
										aria-describedby={hasError ? BUY_IN_ERROR_ID : undefined}
										aria-invalid={hasError}
										aria-label="Max buy-in"
										className="min-w-0 flex-1 bg-transparent font-mono outline-none"
										id={fieldId(maxField.name)}
										inputMode="numeric"
										onBlur={maxField.handleBlur}
										onChange={(e) => maxField.handleChange(e.target.value)}
										type="text"
										value={maxField.state.value}
									/>
								</div>
								{errorMessage ? (
									<p
										className="mt-1 text-[length:var(--text-xs)] text-destructive"
										id={BUY_IN_ERROR_ID}
										role="alert"
									>
										{errorMessage}
									</p>
								) : null}
							</div>
						);
					}}
				</form.Field>
			)}
		</form.Field>
	);
}

function TableSizeField({
	form,
	master,
	tableSizes,
}: {
	form: SessionForm;
	master: MasterFieldValues | null;
	tableSizes: readonly number[];
}) {
	return (
		<form.Field name="tableSize">
			{(field) => (
				<Field
					className="col-span-2 min-w-0 gap-0"
					error={field.state.meta.errors[0]?.message}
					htmlFor={fieldId(field.name)}
					label={
						<FieldLabel
							isDifferent={isMasterFieldDifferent(
								master,
								"tableSize",
								field.state.value
							)}
							label="Table size"
						/>
					}
				>
					<select
						className={cn(CONTROL_CLASS, "mt-1.5 px-2")}
						id={fieldId(field.name)}
						onChange={(e) => field.handleChange(e.target.value)}
						value={field.state.value}
					>
						<option disabled value="">
							—
						</option>
						{tableSizes.map((size) => (
							<option key={size} value={size}>
								{size}
							</option>
						))}
					</select>
				</Field>
			)}
		</form.Field>
	);
}

interface SessionBasicsTabProps {
	blindLabels: BlindSlotLabels;
	currencyLabel: string;
	currencyUnit: string | null;
	form: SessionForm;
	isCash: boolean;
	isCurrencyDifferent: boolean;
	master: MasterFieldValues | null;
	onOpenCurrency: () => void;
	purchaseOptions: readonly ChipPurchaseOption[];
	tableSizes: readonly number[];
	variantLabel: string;
}

export function SessionBasicsTab({
	blindLabels,
	currencyLabel,
	currencyUnit,
	form,
	isCash,
	isCurrencyDifferent,
	master,
	onOpenCurrency,
	purchaseOptions,
	tableSizes,
	variantLabel,
}: SessionBasicsTabProps) {
	return (
		<div className="grid grid-cols-6 items-end gap-x-2 gap-y-3">
			<form.Field name="ruleName">
				{(field) => (
					<Field
						className="col-span-6 min-w-0 gap-0"
						error={field.state.meta.errors[0]?.message}
						htmlFor="cryst-session-rule-name"
						label={
							<FieldLabel
								isDifferent={isMasterFieldDifferent(
									master,
									"ruleName",
									field.state.value
								)}
								label="Rule name"
							/>
						}
						required
					>
						<input
							{...NO_INPUT_SUGGESTIONS}
							className={cn(CONTROL_CLASS, "mt-1.5")}
							id="cryst-session-rule-name"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<div className="col-span-6 min-w-0">
				<div className={FIELD_LABEL_CLASS}>Game type</div>
				<div
					className={cn(
						CONTROL_CLASS,
						"flex items-center justify-between gap-2 text-muted-foreground"
					)}
				>
					<span className="min-w-0 truncate font-medium text-foreground">
						{variantLabel === "" ? "Not set" : variantLabel}
					</span>
					<IconChevronRight size={16} />
				</div>
			</div>

			{isCash ? (
				<>
					<NumericField
						form={form}
						label={blindLabels.blind1}
						master={master}
						name="blind1"
					/>
					<NumericField
						form={form}
						label={blindLabels.blind2}
						master={master}
						name="blind2"
					/>
					{blindLabels.blind3 === null ? null : (
						<NumericField
							form={form}
							label={blindLabels.blind3}
							master={master}
							name="blind3"
						/>
					)}
				</>
			) : null}

			{isCash ? (
				<form.Field name="anteType">
					{(anteTypeField) => (
						<>
							<fieldset className="col-span-4 min-w-0">
								<legend className={FIELD_LABEL_CLASS}>
									<FieldLabel
										isDifferent={isMasterFieldDifferent(
											master,
											"anteType",
											anteTypeField.state.value
										)}
										label="Ante type"
									/>
								</legend>
								<SegmentedButtons
									columns={3}
									onChange={anteTypeField.handleChange}
									options={ANTE_TYPES}
									value={anteTypeField.state.value}
								/>
							</fieldset>
							<NumericField
								disabled={anteTypeField.state.value === "none"}
								form={form}
								label="Ante"
								master={master}
								name="ante"
							/>
						</>
					)}
				</form.Field>
			) : null}

			<div className="col-span-6 min-w-0">
				<div className={FIELD_LABEL_CLASS}>
					<FieldLabel isDifferent={isCurrencyDifferent} label="Currency" />
				</div>
				<button
					className={cn(
						CONTROL_CLASS,
						"flex items-center justify-between gap-2 text-left hover:bg-accent"
					)}
					onClick={onOpenCurrency}
					type="button"
				>
					<span className="min-w-0 truncate font-medium">{currencyLabel}</span>
					<IconChevronRight className="text-muted-foreground" size={16} />
				</button>
			</div>

			{isCash ? (
				<>
					<BuyInRangeField form={form} master={master} />
					<TableSizeField form={form} master={master} tableSizes={tableSizes} />
				</>
			) : (
				<>
					<NumericField
						form={form}
						label="Buy-in"
						master={master}
						name="tournamentBuyIn"
						span="col-span-3"
					/>
					<NumericField
						form={form}
						label="Entry fee"
						master={master}
						name="entryFee"
						span="col-span-3"
					/>
					<NumericField
						form={form}
						label="Starting stack"
						master={master}
						name="startingStack"
					/>
					<NumericField
						form={form}
						label="Bounty"
						master={master}
						name="bountyAmount"
					/>
				</>
			)}

			{isCash || purchaseOptions.length === 0 ? null : (
				<div className="col-span-6 min-w-0">
					<div className={FIELD_LABEL_CLASS}>Purchase options</div>
					<div className="flex flex-col rounded-lg border border-border px-2.5 py-0.5">
						{purchaseOptions.map((option, index) => (
							<div
								className={cn(
									"flex justify-between gap-2 py-2 text-[length:var(--text-sm)]",
									index === purchaseOptions.length - 1
										? null
										: "border-border border-b"
								)}
								key={option.id}
							>
								<span className="min-w-0 truncate">{option.name}</span>
								<span className="shrink-0 font-mono">
									{`${formatWithUnit(option.cost, currencyUnit)} → ${formatWithUnit(option.chips, "chips")}`}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{isCash ? null : (
				<TableSizeField form={form} master={master} tableSizes={tableSizes} />
			)}
		</div>
	);
}
