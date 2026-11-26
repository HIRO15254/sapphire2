import { IconChevronDown, IconPlayCard, IconStack2 } from "@tabler/icons-react";
import { Field } from "@/shared/components/ui/field";
import { GamePicker } from "./game-picker";
import { type UseGameFieldOptions, useGameField } from "./use-game-field";

interface GameFieldProps extends UseGameFieldOptions {
	error?: string;
}

export function GameField({ error, ...options }: GameFieldProps) {
	const { buttonLabel, display, id, isPickerOpen, onOpenPicker, picker } =
		useGameField(options);

	return (
		<>
			<Field error={error} htmlFor={id} label="Game" required>
				<button
					aria-expanded={isPickerOpen}
					aria-haspopup="dialog"
					aria-label={buttonLabel}
					className="bg-card border-input hover:layer-accent active:layer-accent-pressed aria-invalid:border-destructive flex h-[var(--m-control)] w-full cursor-pointer items-center gap-2 rounded-lg border pr-2.5 pl-3 text-left text-[length:var(--m-text-body)] outline-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]"
					id={id}
					onClick={onOpenPicker}
					type="button"
				>
					<span className="text-muted-foreground flex">
						{display?.isMix ? (
							<IconStack2 aria-hidden className="size-4" />
						) : (
							<IconPlayCard aria-hidden className="size-4" />
						)}
					</span>
					<span
						className={
							display
								? "min-w-0 flex-1 truncate"
								: "text-muted-foreground min-w-0 flex-1 truncate"
						}
					>
						{display?.label ?? "Choose a game"}
					</span>
					<span className="text-muted-foreground font-mono text-xs">
						{display?.meta}
					</span>
					<IconChevronDown
						aria-hidden
						className="text-muted-foreground size-4"
					/>
				</button>
			</Field>
			<GamePicker open={isPickerOpen} {...picker} />
		</>
	);
}
