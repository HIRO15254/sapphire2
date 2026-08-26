import {
	type Icon,
	IconClockCheck,
	IconClockExclamation,
	IconClockPause,
	IconPencilCheck,
	IconStack2,
	IconUsers,
} from "@tabler/icons-react";
import type { StackStaleness } from "@/features/live-sessions/utils/stack-staleness";
import { useStackQuickInput } from "./use-stack-quick-input";

export interface StackQuickInputProps {
	defaultRemainingPlayers?: number | null;
	defaultTotalEntries?: number | null;
	disabled: boolean;
	isPending: boolean;
	kind: "cash_game" | "tournament";
	lastStackUpdatedAt: Date | string | number | null;
	onRecordStack: (values: {
		remainingPlayers?: number;
		stackAmount: number;
		totalEntries?: number;
	}) => void;
}

const STALENESS_ICON: Record<StackStaleness["tone"], Icon> = {
	muted: IconClockCheck,
	warning: IconClockPause,
	destructive: IconClockExclamation,
};

const STALENESS_TEXT_CLASS: Record<StackStaleness["tone"], string> = {
	muted: "text-muted-foreground",
	warning: "text-warning",
	destructive: "text-destructive",
};

export function StackQuickInput({
	defaultRemainingPlayers,
	defaultTotalEntries,
	disabled,
	isPending,
	kind,
	lastStackUpdatedAt,
	onRecordStack,
}: StackQuickInputProps) {
	const { form, lastUpdateText, showStaleness, staleness } = useStackQuickInput(
		{
			defaultRemainingPlayers,
			defaultTotalEntries,
			kind,
			lastStackUpdatedAt,
			onRecordStack,
		}
	);
	const isTournament = kind === "tournament";
	const fieldsDisabled = disabled || isPending;
	const ToneIcon = STALENESS_ICON[staleness.tone];

	return (
		<div className="flex flex-col gap-1.5 border-border border-t bg-card px-[var(--m-inset)] pt-2">
			<form
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div
					className="grid items-center gap-1.5"
					style={{
						gridTemplateColumns: isTournament ? "1fr auto auto" : "1fr auto",
					}}
				>
					<form.Field name="stackAmount">
						{(field) => (
							<label className="flex h-[var(--m-control)] min-w-0 items-center gap-1.5 rounded-md border border-input bg-background px-2.5">
								<IconStack2 className="size-3.5 shrink-0 text-muted-foreground" />
								<input
									aria-label="Stack amount"
									className="min-w-0 flex-1 border-none bg-transparent font-mono text-[length:var(--m-text-secondary)] text-foreground outline-none"
									disabled={fieldsDisabled}
									inputMode="numeric"
									onChange={(event) => field.handleChange(event.target.value)}
									type="text"
									value={field.state.value}
								/>
							</label>
						)}
					</form.Field>
					{isTournament ? (
						<div className="flex h-[var(--m-control)] items-center gap-0.5 rounded-md border border-input bg-background px-2">
							<IconUsers className="mr-1 size-3.5 shrink-0 text-muted-foreground" />
							<form.Field name="remainingPlayers">
								{(field) => (
									<input
										aria-label="Remaining players"
										className="w-9 border-none bg-transparent text-right font-mono text-[length:var(--m-text-secondary)] text-foreground outline-none"
										disabled={fieldsDisabled}
										inputMode="numeric"
										onChange={(event) => field.handleChange(event.target.value)}
										type="text"
										value={field.state.value}
									/>
								)}
							</form.Field>
							<span className="font-mono text-[length:var(--m-text-secondary)] text-muted-foreground">
								/
							</span>
							<form.Field name="totalEntries">
								{(field) => (
									<input
										aria-label="Total entries"
										className="w-10 border-none bg-transparent font-mono text-[length:var(--m-text-secondary)] text-muted-foreground outline-none"
										disabled={fieldsDisabled}
										inputMode="numeric"
										onChange={(event) => field.handleChange(event.target.value)}
										type="text"
										value={field.state.value}
									/>
								)}
							</form.Field>
						</div>
					) : null}
					<button
						aria-label="Save stack"
						className="flex size-[var(--m-control)] shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:brightness-108 active:brightness-94 disabled:opacity-50"
						disabled={fieldsDisabled}
						title="Save stack"
						type="submit"
					>
						<IconPencilCheck className="size-4.5" />
					</button>
				</div>
			</form>
			{showStaleness ? (
				<div
					className={`flex items-center gap-1.5 pb-2 text-[11px] ${STALENESS_TEXT_CLASS[staleness.tone]}`}
				>
					<ToneIcon className="size-3" />
					<span>
						Last update <span className="font-mono">{lastUpdateText}</span> ·{" "}
						{staleness.agoText}
					</span>
				</div>
			) : null}
		</div>
	);
}
