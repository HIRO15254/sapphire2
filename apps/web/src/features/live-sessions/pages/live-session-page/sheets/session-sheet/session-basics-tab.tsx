import { IconChevronRight } from "@tabler/icons-react";
import type { ChipPurchaseOption } from "@/features/live-sessions/pages/live-session-page/sheets/event-editor-sheet";
import { formatWithUnit } from "@/features/live-sessions/utils/session-settings";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import type { BlindSlotLabels } from "@/shared/hooks/use-game-groups";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import type { AnteType } from "./session-sheet-view";
import type { SessionForm } from "./use-session-sheet";

const ANTE_TYPES: { key: AnteType; label: string }[] = [
	{ key: "none", label: "None" },
	{ key: "bb", label: "BB" },
	{ key: "all", label: "All" },
];

const FIELD_LABEL_CLASS =
	"mb-1.5 block font-medium text-[length:var(--text-sm)] text-foreground";
const CONTROL_CLASS =
	"box-border h-[var(--m-control)] w-full rounded-lg border border-input bg-card px-2.5 text-[length:var(--m-text-body)] outline-none focus-visible:border-ring aria-invalid:border-destructive";
const NUMBER_CLASS = `${CONTROL_CLASS} font-mono`;

function fieldId(name: string) {
	return `cryst-session-${name}`;
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
	form,
	label,
	name,
	span = "col-span-2",
}: {
	form: SessionForm;
	label: string;
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
					label={label}
				>
					<input
						{...NO_INPUT_SUGGESTIONS}
						className={cn(NUMBER_CLASS, "mt-1.5")}
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

interface SessionBasicsTabProps {
	blindLabels: BlindSlotLabels;
	currencyLabel: string;
	currencyUnit: string | null;
	form: SessionForm;
	isCash: boolean;
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
						label="Rule name"
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
					<NumericField form={form} label={blindLabels.blind1} name="blind1" />
					<NumericField form={form} label={blindLabels.blind2} name="blind2" />
					{blindLabels.blind3 === null ? null : (
						<NumericField
							form={form}
							label={blindLabels.blind3}
							name="blind3"
						/>
					)}
				</>
			) : null}

			<div className="col-span-6 min-w-0">
				<div className={FIELD_LABEL_CLASS}>Currency</div>
				<button
					className={cn(
						CONTROL_CLASS,
						"flex items-center justify-between gap-2 text-left hover:bg-muted"
					)}
					onClick={onOpenCurrency}
					type="button"
				>
					<span className="min-w-0 truncate font-medium">{currencyLabel}</span>
					<IconChevronRight className="text-muted-foreground" size={16} />
				</button>
			</div>

			{isCash ? (
				<form.Field name="anteType">
					{(field) => (
						<fieldset className="col-span-4 min-w-0">
							<legend className={FIELD_LABEL_CLASS}>Ante type</legend>
							<div className="grid grid-cols-3 gap-1.5">
								{ANTE_TYPES.map((option) => (
									<button
										aria-pressed={field.state.value === option.key}
										className={cn(
											"h-[var(--m-control)] rounded-full border font-semibold text-[length:var(--text-sm)]",
											field.state.value === option.key
												? "border-primary bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] text-primary"
												: "border-border bg-transparent text-muted-foreground"
										)}
										key={option.key}
										onClick={() => field.handleChange(option.key)}
										type="button"
									>
										{option.label}
									</button>
								))}
							</div>
						</fieldset>
					)}
				</form.Field>
			) : null}

			{isCash ? (
				<>
					<NumericField form={form} label="Ante" name="ante" />
					<NumericField
						form={form}
						label="Min buy-in"
						name="minBuyIn"
						span="col-span-3"
					/>
					<NumericField
						form={form}
						label="Max buy-in"
						name="maxBuyIn"
						span="col-span-3"
					/>
				</>
			) : (
				<>
					<NumericField
						form={form}
						label="Buy-in"
						name="tournamentBuyIn"
						span="col-span-3"
					/>
					<NumericField
						form={form}
						label="Entry fee"
						name="entryFee"
						span="col-span-3"
					/>
					<NumericField
						form={form}
						label="Starting stack"
						name="startingStack"
					/>
					<NumericField form={form} label="Bounty" name="bountyAmount" />
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

			<form.Field name="tableSize">
				{(field) => (
					<Field
						className="col-span-2 min-w-0 gap-0"
						error={field.state.meta.errors[0]?.message}
						htmlFor="cryst-session-table-size"
						label="Table size"
					>
						<select
							className={cn(CONTROL_CLASS, "mt-1.5 px-2")}
							id="cryst-session-table-size"
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
		</div>
	);
}
