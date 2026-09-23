import {
	IconCards,
	IconClock,
	IconCoffee,
	IconPlus,
	IconStack2,
	IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { BlindSlotLabels } from "@/shared/hooks/use-game-groups";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import {
	CRYST_FIELD,
	CRYST_FIELD_GROUP,
	crystButton,
} from "../../cryst-controls";
import type { BlindCell, BlindRowView } from "./use-session-sheet";

const ROW_GRID = "grid grid-cols-[34px_1fr_1fr_52px_44px] items-center gap-1.5";
const CELL_CLASS = `${CRYST_FIELD} box-border h-[var(--m-control)] w-full min-w-0 px-2 font-mono text-[length:var(--m-text-secondary)]`;
const INLINE_GROUP_CLASS = `${CRYST_FIELD_GROUP} box-border inline-flex h-[var(--m-control)] min-w-0 items-center gap-1.5 px-2 has-[input[aria-invalid=true]]:border-destructive`;
const INLINE_INPUT_CLASS =
	"w-14 min-w-0 bg-transparent font-mono text-[length:var(--m-text-secondary)] outline-none";
const CAPTION_CLASS =
	"text-[length:var(--m-text-caption)] text-muted-foreground";

function labelColor(row: BlindRowView): string {
	if (row.isCurrent) {
		return "text-primary";
	}
	return row.isBreak ? "text-warning" : "text-foreground";
}

function CellInput({
	cell,
	label,
	onChange,
	row,
}: {
	cell: BlindCell;
	label: string;
	onChange: (cell: BlindCell, value: string) => void;
	row: BlindRowView;
}) {
	const error = row.errors[cell];
	return (
		<input
			{...NO_INPUT_SUGGESTIONS}
			aria-describedby={error ? `${row.uid}-error` : undefined}
			aria-invalid={error !== undefined}
			aria-label={`${row.groupLabel} ${label}`}
			className={cn(CELL_CLASS, cell === "minutes" ? "text-center" : null)}
			inputMode="numeric"
			onChange={(e) => onChange(cell, e.target.value)}
			type="text"
			value={row[cell]}
		/>
	);
}

function InlineField({
	cell,
	label,
	onChange,
	row,
}: {
	cell: BlindCell;
	label: string;
	onChange: (cell: BlindCell, value: string) => void;
	row: BlindRowView;
}) {
	const error = row.errors[cell];
	return (
		<label className={INLINE_GROUP_CLASS}>
			<span className={cn(CAPTION_CLASS, "whitespace-nowrap")}>{label}</span>
			<input
				{...NO_INPUT_SUGGESTIONS}
				aria-describedby={error ? `${row.uid}-error` : undefined}
				aria-invalid={error !== undefined}
				aria-label={`${row.groupLabel} ${label}`}
				className={INLINE_INPUT_CLASS}
				inputMode="numeric"
				onChange={(e) => onChange(cell, e.target.value)}
				type="text"
				value={row[cell]}
			/>
		</label>
	);
}

interface SessionBlindsTabProps {
	blindLabels: BlindSlotLabels;
	defaultMinutes: string;
	onAddBreak: () => void;
	onAddLevel: () => void;
	onCellChange: (uid: string, cell: BlindCell, value: string) => void;
	onDefaultMinutesChange: (value: string) => void;
	onOpenGames: (uid: string, levelNumber: number) => void;
	onRemoveRow: (uid: string) => void;
	rows: BlindRowView[];
	summary: string;
}

export function SessionBlindsTab({
	blindLabels,
	defaultMinutes,
	onAddBreak,
	onAddLevel,
	onCellChange,
	onDefaultMinutesChange,
	onOpenGames,
	onRemoveRow,
	rows,
	summary,
}: SessionBlindsTabProps) {
	return (
		<div className="flex flex-col gap-2.5">
			<div className="grid grid-cols-[auto_1fr] items-center gap-2">
				<label className={INLINE_GROUP_CLASS}>
					<IconClock
						aria-hidden
						className="shrink-0 text-muted-foreground"
						size={15}
					/>
					<input
						{...NO_INPUT_SUGGESTIONS}
						aria-label="Default level length in minutes"
						className="w-8 min-w-0 bg-transparent text-right font-mono text-[length:var(--m-text-secondary)] outline-none"
						inputMode="numeric"
						onChange={(e) => onDefaultMinutesChange(e.target.value)}
						type="text"
						value={defaultMinutes}
					/>
					<span className={CAPTION_CLASS}>min default</span>
				</label>
				<div
					className={cn(
						CAPTION_CLASS,
						"flex items-center justify-end gap-1.5 whitespace-nowrap"
					)}
				>
					<IconStack2 aria-hidden className="shrink-0" size={14} />
					<span>{summary}</span>
				</div>
			</div>

			<div
				aria-hidden
				className={cn(
					ROW_GRID,
					"px-1 font-semibold text-[11px] text-muted-foreground"
				)}
			>
				<span>Lv</span>
				<span className="truncate">{blindLabels.blind1}</span>
				<span className="truncate">{blindLabels.blind2}</span>
				<span className="text-center">Min</span>
				<span />
			</div>

			<div className="flex flex-col gap-1">
				{rows.map((row) => {
					const { levelNumber } = row;
					const onChange = (cell: BlindCell, value: string) =>
						onCellChange(row.uid, cell, value);
					const error = Object.values(row.errors).find(
						(message) => message !== undefined
					);
					return (
						<fieldset
							aria-current={row.isCurrent ? "step" : undefined}
							aria-label={row.groupLabel}
							className={cn(
								"flex min-w-0 flex-col gap-1 rounded-md px-1 py-1",
								row.isCurrent
									? "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]"
									: null
							)}
							key={row.uid}
						>
							<div className={ROW_GRID}>
								<span
									className={cn(
										"font-mono font-semibold text-[length:var(--m-text-caption)]",
										labelColor(row)
									)}
								>
									{row.label}
								</span>
								{row.isBreak ? (
									<span className="col-span-2 inline-flex items-center gap-1.5 text-[length:var(--m-text-caption)] text-warning">
										<IconCoffee aria-hidden size={14} />
										Break
									</span>
								) : (
									<>
										<CellInput
											cell="blind1"
											label={blindLabels.blind1}
											onChange={onChange}
											row={row}
										/>
										<CellInput
											cell="blind2"
											label={blindLabels.blind2}
											onChange={onChange}
											row={row}
										/>
									</>
								)}
								<CellInput
									cell="minutes"
									label="minutes"
									onChange={onChange}
									row={row}
								/>
								<button
									aria-label={`Remove ${row.groupLabel.toLowerCase()}`}
									className={cn(
										crystButton({ size: "icon", variant: "ghost" }),
										"w-11 hover:text-destructive"
									)}
									onClick={() => onRemoveRow(row.uid)}
									type="button"
								>
									<IconX aria-hidden size={14} />
								</button>
							</div>
							{row.isBreak || levelNumber === null ? null : (
								<div className="flex flex-wrap items-center gap-1.5 pl-10">
									{blindLabels.blind3 === null ? null : (
										<InlineField
											cell="blind3"
											label={blindLabels.blind3}
											onChange={onChange}
											row={row}
										/>
									)}
									<InlineField
										cell="ante"
										label="Ante"
										onChange={onChange}
										row={row}
									/>
									<button
										aria-label={`${row.gamesLabel} for ${row.groupLabel.toLowerCase()}`}
										className={cn(
											"inline-flex h-[var(--m-control)] items-center gap-1 whitespace-nowrap rounded-full border px-3 font-semibold text-[11px] transition-[filter] hover:brightness-110",
											row.hasGames
												? "border-[color-mix(in_oklab,var(--info)_45%,transparent)] bg-[color-mix(in_oklab,var(--info)_14%,transparent)] text-info"
												: "border-border bg-transparent text-muted-foreground"
										)}
										onClick={() => onOpenGames(row.uid, levelNumber)}
										type="button"
									>
										<IconCards aria-hidden size={12} />
										{row.gamesLabel}
									</button>
								</div>
							)}
							{error ? (
								<p
									className="pl-10 text-[length:var(--text-xs)] text-destructive"
									id={`${row.uid}-error`}
									role="alert"
								>
									{error}
								</p>
							) : null}
						</fieldset>
					);
				})}
			</div>

			<div className="flex gap-1.5">
				<button
					className={cn(crystButton({ variant: "outline" }), "flex-1")}
					onClick={onAddLevel}
					type="button"
				>
					<IconPlus aria-hidden size={15} />
					Add level
				</button>
				<button
					className={cn(
						crystButton({ variant: "outline" }),
						"flex-1 text-warning"
					)}
					onClick={onAddBreak}
					type="button"
				>
					<IconCoffee aria-hidden size={15} />
					Add break
				</button>
			</div>
			<p className="text-pretty text-[length:var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]">
				Levels are renumbered automatically; breaks sit between them. Editing a
				level that has already been played does not change past events.
			</p>
		</div>
	);
}
