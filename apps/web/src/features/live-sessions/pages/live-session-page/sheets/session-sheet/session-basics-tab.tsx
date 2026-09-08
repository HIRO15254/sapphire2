import { IconChevronRight } from "@tabler/icons-react";
import type { ChipPurchaseOption } from "@/features/live-sessions/pages/live-session-page/sheets/event-editor-sheet";
import { formatWithUnit } from "@/features/live-sessions/utils/session-settings";
import { cn } from "@/lib/utils";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";

const ANTE_TYPES: { key: "all" | "bb" | "none"; label: string }[] = [
	{ key: "none", label: "None" },
	{ key: "bb", label: "BB" },
	{ key: "all", label: "All" },
];

const FIELD_LABEL_CLASS =
	"mb-1.5 block font-medium text-[length:var(--text-sm)] text-foreground";
const CONTROL_CLASS =
	"box-border h-[var(--m-control)] w-full rounded-lg border border-input bg-card px-2.5 text-[length:var(--m-text-body)] outline-none focus-visible:border-ring";
const NUMBER_CLASS = `${CONTROL_CLASS} font-mono`;

export interface BasicsField {
	label: string;
	name: string;
	placeholder: string;
	span: string;
	value: string;
}

interface SessionBasicsTabProps {
	anteType: "all" | "bb" | "none";
	blindFields: readonly BasicsField[];
	currencyLabel: string;
	currencyUnit: string | null;
	isCash: boolean;
	numberFields: readonly BasicsField[];
	onChangeField: (name: string, value: string) => void;
	onCommitField: (name: string) => void;
	onCommitRuleName: () => void;
	onOpenCurrency: () => void;
	onSelectAnteType: (anteType: "all" | "bb" | "none") => void;
	onSelectTableSize: (tableSize: number) => void;
	purchaseOptions: readonly ChipPurchaseOption[];
	ruleName: string;
	tableSize: number | null;
	tableSizes: readonly number[];
	variantLabel: string;
}

function NumberField({
	field,
	onChangeField,
	onCommitField,
}: {
	field: BasicsField;
	onChangeField: (name: string, value: string) => void;
	onCommitField: (name: string) => void;
}) {
	return (
		<div className={cn(field.span, "min-w-0")}>
			<label
				className={FIELD_LABEL_CLASS}
				htmlFor={`cryst-session-${field.name}`}
			>
				{field.label}
			</label>
			<input
				{...NO_INPUT_SUGGESTIONS}
				className={NUMBER_CLASS}
				id={`cryst-session-${field.name}`}
				inputMode="numeric"
				onBlur={() => onCommitField(field.name)}
				onChange={(e) => onChangeField(field.name, e.target.value)}
				placeholder={field.placeholder}
				type="text"
				value={field.value}
			/>
		</div>
	);
}

export function SessionBasicsTab({
	anteType,
	blindFields,
	currencyLabel,
	currencyUnit,
	isCash,
	numberFields,
	onChangeField,
	purchaseOptions,
	onCommitField,
	onCommitRuleName,
	onOpenCurrency,
	onSelectAnteType,
	onSelectTableSize,
	ruleName,
	tableSize,
	tableSizes,
	variantLabel,
}: SessionBasicsTabProps) {
	return (
		<div className="grid grid-cols-6 items-end gap-x-2 gap-y-3">
			<div className="col-span-6 min-w-0">
				<label className={FIELD_LABEL_CLASS} htmlFor="cryst-session-rule-name">
					Rule name
				</label>
				<input
					{...NO_INPUT_SUGGESTIONS}
					className={CONTROL_CLASS}
					id="cryst-session-rule-name"
					onBlur={onCommitRuleName}
					onChange={(e) => onChangeField("ruleName", e.target.value)}
					type="text"
					value={ruleName}
				/>
			</div>

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

			{blindFields.map((field) => (
				<NumberField
					field={field}
					key={field.name}
					onChangeField={onChangeField}
					onCommitField={onCommitField}
				/>
			))}

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
				<fieldset className="col-span-4 min-w-0">
					<legend className={FIELD_LABEL_CLASS}>Ante type</legend>
					<div className="grid grid-cols-3 gap-1.5">
						{ANTE_TYPES.map((option) => (
							<button
								aria-pressed={anteType === option.key}
								className={cn(
									"h-[var(--m-control)] rounded-full border font-semibold text-[length:var(--text-sm)]",
									anteType === option.key
										? "border-primary bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] text-primary"
										: "border-border bg-transparent text-muted-foreground"
								)}
								key={option.key}
								onClick={() => onSelectAnteType(option.key)}
								type="button"
							>
								{option.label}
							</button>
						))}
					</div>
				</fieldset>
			) : null}

			{numberFields.map((field) => (
				<NumberField
					field={field}
					key={field.name}
					onChangeField={onChangeField}
					onCommitField={onCommitField}
				/>
			))}

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

			<div className="col-span-2 min-w-0">
				<label className={FIELD_LABEL_CLASS} htmlFor="cryst-session-table-size">
					Table size
				</label>
				<select
					className={cn(CONTROL_CLASS, "px-2")}
					id="cryst-session-table-size"
					onChange={(e) => onSelectTableSize(Number(e.target.value))}
					value={tableSize ?? ""}
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
			</div>
		</div>
	);
}
