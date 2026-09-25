import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import {
	CRYST_FIELD,
	CRYST_INLINE_FIELD,
	CRYST_TAG,
	crystButton,
} from "../../cryst-controls";
import type { MixAmountSlot } from "./use-mix-editor-sheet";

interface MixGroupCardProps {
	cells: {
		error: string | undefined;
		label: string;
		slot: MixAmountSlot;
		value: string;
	}[];
	name: string;
	number: number;
	onAddGames: () => void;
	onCellChange: (slot: MixAmountSlot, value: string) => void;
	onRemove: () => void;
	onRemoveVariant: (label: string) => void;
	onRename: (name: string) => void;
	onRenameEnd: () => void;
	variants: { code: string; label: string }[];
}

export function MixGroupCard({
	cells,
	name,
	number,
	onAddGames,
	onCellChange,
	onRemove,
	onRemoveVariant,
	onRename,
	onRenameEnd,
	variants,
}: MixGroupCardProps) {
	const groupLabel = `Group ${number}`;
	const errorId = `cryst-mix-group-${number}-error`;
	const cellError = cells.find((cell) => cell.error !== undefined)?.error;

	return (
		<fieldset
			aria-label={groupLabel}
			className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-2.5"
		>
			<div className="flex items-center gap-1.5">
				<span
					aria-hidden
					className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-bold font-mono text-[11px] text-muted-foreground"
				>
					{number}
				</span>
				<input
					{...NO_INPUT_SUGGESTIONS}
					aria-label={`${groupLabel} name`}
					className={cn(
						CRYST_INLINE_FIELD,
						"h-[var(--m-control)] min-w-0 flex-1 px-2 font-semibold text-[length:var(--m-text-secondary)]"
					)}
					maxLength={30}
					onBlur={onRenameEnd}
					onChange={(e) => onRename(e.target.value)}
					type="text"
					value={name}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				{variants.map((variant) => (
					<span
						className={cn(CRYST_TAG, "gap-1 pr-0.5 font-mono")}
						key={variant.label}
						title={variant.label}
					>
						{variant.code}
						<button
							aria-label={`Remove ${variant.label}`}
							className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							onClick={() => onRemoveVariant(variant.label)}
							type="button"
						>
							<IconX aria-hidden size={12} />
						</button>
					</span>
				))}
				<button
					aria-label={`Add games to ${groupLabel.toLowerCase()}`}
					className={crystButton({ size: "sm", variant: "outline" })}
					onClick={onAddGames}
					type="button"
				>
					<IconPlus aria-hidden size={14} />
					Game
				</button>
			</div>

			{cells.length === 0 ? null : (
				<div
					className={cn(
						"grid gap-1.5",
						cells.length === 4 ? "grid-cols-4" : "grid-cols-3"
					)}
				>
					{cells.map((cell) => (
						<label className="flex min-w-0 flex-col gap-1" key={cell.slot}>
							<span className="truncate text-[length:var(--m-text-caption)] text-muted-foreground">
								{cell.label}
							</span>
							<input
								{...NO_INPUT_SUGGESTIONS}
								aria-describedby={cell.error ? errorId : undefined}
								aria-invalid={cell.error !== undefined}
								aria-label={`${groupLabel} ${cell.label}`}
								className={cn(
									CRYST_FIELD,
									"box-border h-[var(--m-control)] w-full min-w-0 px-2 font-mono"
								)}
								inputMode="numeric"
								onChange={(e) => onCellChange(cell.slot, e.target.value)}
								type="text"
								value={cell.value}
							/>
						</label>
					))}
				</div>
			)}
			{cellError ? (
				<p
					className="text-[length:var(--text-xs)] text-destructive"
					id={errorId}
					role="alert"
				>
					{cellError}
				</p>
			) : null}
			<button
				className={cn(
					crystButton({ variant: "outline" }),
					"w-full text-destructive hover:text-destructive"
				)}
				onClick={onRemove}
				type="button"
			>
				<IconTrash aria-hidden size={16} />
				Delete group
			</button>
		</fieldset>
	);
}
