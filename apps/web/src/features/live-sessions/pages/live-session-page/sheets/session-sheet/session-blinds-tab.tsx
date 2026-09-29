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
	CRYST_FIELD_GROUP,
	CRYST_FIELD_MD,
	crystButton,
} from "../../cryst-controls";
import type {
	BlindCell,
	BlindRowView,
	MixStakeSlot,
} from "./use-session-sheet";

const ROW_GRID = "grid items-center gap-1";
const LEVEL_LAYOUT = {
	threeBlinds: {
		grid: "grid-cols-[24px_repeat(4,minmax(0,1fr))_24px_32px_22px]",
		wide: "col-span-5",
	},
	twoBlinds: {
		grid: "grid-cols-[24px_repeat(3,minmax(0,1fr))_24px_32px_22px]",
		wide: "col-span-4",
	},
} as const;
type LevelLayout = (typeof LEVEL_LAYOUT)[keyof typeof LEVEL_LAYOUT];
const CELL_CLASS = cn(
	CRYST_FIELD_MD,
	"box-border h-8 w-full min-w-0 px-1 font-mono text-[length:var(--m-text-caption)]"
);
const DEFAULT_MINUTES_CLASS = `${CRYST_FIELD_GROUP} box-border inline-flex h-[var(--m-control)] min-w-0 items-center gap-1.5 px-2`;
const STACKED_CELL_CLASS = cn(
	CRYST_FIELD_GROUP,
	"box-border flex h-8 min-w-0 flex-1 flex-col justify-center rounded-md px-1 has-[input[aria-invalid=true]]:border-destructive"
);
const STACKED_CAPTION_CLASS =
	"truncate text-[length:var(--text-xs)] text-muted-foreground leading-tight";
const STACKED_INPUT_CLASS =
	"h-3.5 w-full min-w-0 bg-transparent font-mono text-[length:var(--m-text-caption)] leading-none outline-none";
const CAPTION_CLASS =
	"text-[length:var(--m-text-caption)] text-muted-foreground";
const ROW_ICON_BUTTON_CLASS = cn(
	crystButton({ size: null, variant: "ghost" }),
	"h-8 w-full rounded-md"
);
const GAMES_PILL_CLASS =
	"inline-flex h-7 min-w-0 items-center gap-1 whitespace-nowrap rounded-full border border-[color-mix(in_oklab,var(--info)_45%,transparent)] bg-[color-mix(in_oklab,var(--info)_14%,transparent)] px-2 font-semibold text-[length:var(--text-xs)] text-info transition-[filter] hover:brightness-110";

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

function GamesPill({
	className,
	name,
	onClick,
	row,
}: {
	className: string;
	name: string;
	onClick: () => void;
	row: BlindRowView;
}) {
	return (
		<button
			aria-label={`${name}, games for ${row.groupLabel.toLowerCase()}`}
			className={cn(GAMES_PILL_CLASS, className)}
			onClick={onClick}
			type="button"
		>
			<IconCards aria-hidden className="shrink-0" size={12} />
			<span className="min-w-0 truncate">{name}</span>
		</button>
	);
}

function GamesButton({
	onClick,
	row,
}: {
	onClick: (() => void) | null;
	row: BlindRowView;
}) {
	if (onClick === null) {
		return <span />;
	}
	return (
		<button
			aria-label={`Games for ${row.groupLabel.toLowerCase()}`}
			className={cn(ROW_ICON_BUTTON_CLASS, "border-input")}
			onClick={onClick}
			type="button"
		>
			<IconCards aria-hidden size={14} />
		</button>
	);
}

function GameGroupStakes({
	group,
	isOnlyGroup,
	onChange,
	row,
}: {
	group: BlindRowView["gameGroups"][number];
	isOnlyGroup: boolean;
	onChange: (slot: MixStakeSlot, value: string) => void;
	row: BlindRowView;
}) {
	return (
		<div className="flex min-w-0 items-center gap-1 pl-7">
			{isOnlyGroup ? null : (
				<div className="flex w-[72px] shrink-0 flex-col">
					<span className="truncate font-semibold text-[length:var(--text-xs)] leading-tight">
						{group.name}
					</span>
					<span className="truncate font-mono text-[length:var(--text-xs)] text-muted-foreground leading-tight">
						{group.codes}
					</span>
				</div>
			)}
			{group.cells.map((cell) => (
				<label className={STACKED_CELL_CLASS} key={cell.slot}>
					<span className={STACKED_CAPTION_CLASS}>{cell.label}</span>
					<input
						{...NO_INPUT_SUGGESTIONS}
						aria-describedby={cell.error ? `${row.uid}-error` : undefined}
						aria-invalid={cell.error !== undefined}
						aria-label={`${row.groupLabel} ${group.name} ${cell.label}`}
						className={STACKED_INPUT_CLASS}
						inputMode="numeric"
						onChange={(e) => onChange(cell.slot, e.target.value)}
						type="text"
						value={cell.value}
					/>
				</label>
			))}
		</div>
	);
}

function LevelCells({
	blindLabels,
	layout,
	onChange,
	onOpenGames,
	row,
}: {
	blindLabels: BlindSlotLabels;
	layout: LevelLayout;
	onChange: (cell: BlindCell, value: string) => void;
	onOpenGames: (() => void) | null;
	row: BlindRowView;
}) {
	if (row.isBreak) {
		return (
			<span
				className={cn(
					layout.wide,
					"inline-flex items-center gap-1.5 text-[length:var(--m-text-caption)] text-warning"
				)}
			>
				<IconCoffee aria-hidden size={14} />
				Break
			</span>
		);
	}
	if (row.gamesName !== null && onOpenGames !== null) {
		return (
			<GamesPill
				className={cn(layout.wide, "max-w-full justify-self-start")}
				name={row.gamesName}
				onClick={onOpenGames}
				row={row}
			/>
		);
	}
	return (
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
			{blindLabels.blind3 === null ? null : (
				<CellInput
					cell="blind3"
					label={blindLabels.blind3}
					onChange={onChange}
					row={row}
				/>
			)}
			<CellInput cell="ante" label="Ante" onChange={onChange} row={row} />
			<GamesButton onClick={onOpenGames} row={row} />
		</>
	);
}

function firstRowError(row: BlindRowView): string | undefined {
	const cellError = Object.values(row.errors).find(
		(message) => message !== undefined
	);
	if (cellError !== undefined) {
		return cellError;
	}
	return row.gameGroups
		.flatMap((group) => group.cells)
		.find((cell) => cell.error !== undefined)?.error;
}

interface SessionBlindsTabProps {
	blindLabels: BlindSlotLabels;
	defaultMinutes: string;
	onAddBreak: () => void;
	onAddLevel: () => void;
	onCellChange: (uid: string, cell: BlindCell, value: string) => void;
	onDefaultMinutesChange: (value: string) => void;
	onGameStakeChange: (
		levelUid: string,
		groupUid: string,
		slot: MixStakeSlot,
		value: string
	) => void;
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
	onGameStakeChange,
	onOpenGames,
	onRemoveRow,
	rows,
	summary,
}: SessionBlindsTabProps) {
	const layout =
		blindLabels.blind3 === null
			? LEVEL_LAYOUT.twoBlinds
			: LEVEL_LAYOUT.threeBlinds;
	return (
		<div className="flex flex-col gap-2.5">
			<div className="grid grid-cols-[auto_1fr] items-center gap-2">
				<label className={DEFAULT_MINUTES_CLASS}>
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
					layout.grid,
					"px-1 font-semibold text-[11px] text-muted-foreground"
				)}
			>
				<span>Lv</span>
				<span className="truncate">{blindLabels.blind1}</span>
				<span className="truncate">{blindLabels.blind2}</span>
				{blindLabels.blind3 === null ? null : (
					<span className="truncate">{blindLabels.blind3}</span>
				)}
				<span>Ante</span>
				<span />
				<span className="text-center">Min</span>
				<span />
			</div>

			<div className="flex flex-col gap-1">
				{rows.map((row) => {
					const { levelNumber } = row;
					const onChange = (cell: BlindCell, value: string) =>
						onCellChange(row.uid, cell, value);
					const error = firstRowError(row);
					const openGames =
						levelNumber === null
							? null
							: () => onOpenGames(row.uid, levelNumber);
					return (
						<fieldset
							aria-current={row.isCurrent ? "step" : undefined}
							aria-label={row.groupLabel}
							className={cn(
								"flex min-w-0 flex-col gap-1 rounded-md px-1 py-[5px]",
								row.isCurrent
									? "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]"
									: null
							)}
							key={row.uid}
						>
							<div className={cn(ROW_GRID, layout.grid)}>
								<span
									className={cn(
										"font-mono font-semibold text-[length:var(--m-text-caption)]",
										labelColor(row)
									)}
								>
									{row.label}
								</span>
								<LevelCells
									blindLabels={blindLabels}
									layout={layout}
									onChange={onChange}
									onOpenGames={openGames}
									row={row}
								/>
								<CellInput
									cell="minutes"
									label="minutes"
									onChange={onChange}
									row={row}
								/>
								<button
									aria-label={`Remove ${row.groupLabel.toLowerCase()}`}
									className={cn(
										ROW_ICON_BUTTON_CLASS,
										"hover:text-destructive"
									)}
									onClick={() => onRemoveRow(row.uid)}
									type="button"
								>
									<IconX aria-hidden size={14} />
								</button>
							</div>
							{row.gameGroups.map((group) => (
								<GameGroupStakes
									group={group}
									isOnlyGroup={row.gameGroups.length === 1}
									key={group.uid}
									onChange={(slot, value) =>
										onGameStakeChange(row.uid, group.uid, slot, value)
									}
									row={row}
								/>
							))}
							{error ? (
								<p
									className="pl-7 text-[length:var(--text-xs)] text-destructive"
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
