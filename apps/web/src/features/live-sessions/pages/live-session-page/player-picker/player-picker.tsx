import {
	IconCheck,
	IconSearch,
	IconUser,
	IconUserOff,
	IconUserPlus,
	IconUserQuestion,
	IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";

export type PlayerPickerKind = "existing" | "new" | "temporary";

export interface PlayerPickerCandidate {
	key: string;
	kind: PlayerPickerKind;
	meta: string;
	name: string;
}

interface PlayerPickerProps {
	candidates: readonly PlayerPickerCandidate[];
	emptyLabel: string;
	isDisabled?: boolean;
	onPick: (candidate: PlayerPickerCandidate) => void;
	onQueryChange: (value: string) => void;
	pickedKey: string | null;
	query: string;
	searchLabel: string;
}

const KIND_ICONS = {
	existing: IconUser,
	new: IconUserPlus,
	temporary: IconUserQuestion,
} as const;

function CandidateRow({
	candidate,
	isPicked,
	onPick,
}: {
	candidate: PlayerPickerCandidate;
	isPicked: boolean;
	onPick: (candidate: PlayerPickerCandidate) => void;
}) {
	const Icon = KIND_ICONS[candidate.kind];
	return (
		<button
			aria-pressed={isPicked}
			className={cn(
				"flex min-h-14 w-full items-center gap-3 border-border border-b px-3.5 py-2 text-left last:border-b-0",
				isPicked && "bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]"
			)}
			onClick={() => onPick(candidate)}
			type="button"
		>
			<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
				<Icon
					className={
						candidate.kind === "new" ? "text-primary" : "text-muted-foreground"
					}
					size={16}
				/>
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
				<span className="truncate font-medium text-[length:var(--m-text-secondary)] leading-[1.3]">
					{candidate.name}
				</span>
				<span className="truncate text-[length:var(--m-text-caption)] text-muted-foreground leading-[1.35]">
					{candidate.meta}
				</span>
			</span>
			{isPicked ? (
				<IconCheck className="shrink-0 text-primary" size={16} />
			) : null}
		</button>
	);
}

export function PlayerPicker({
	candidates,
	emptyLabel,
	isDisabled = false,
	onPick,
	onQueryChange,
	pickedKey,
	query,
	searchLabel,
}: PlayerPickerProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-2.5",
				isDisabled && "pointer-events-none opacity-50"
			)}
		>
			<div className="flex h-[var(--m-control)] items-center gap-2 rounded-md border border-border bg-input px-2.5">
				<IconSearch className="shrink-0 text-muted-foreground" size={16} />
				<input
					aria-label={searchLabel}
					{...NO_INPUT_SUGGESTIONS}
					className="min-w-0 flex-1 border-none bg-transparent text-[length:var(--m-text-secondary)] outline-none"
					onChange={(e) => onQueryChange(e.target.value)}
					type="text"
					value={query}
				/>
				{query === "" ? null : (
					<button
						aria-label="Clear search"
						className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
						onClick={() => onQueryChange("")}
						type="button"
					>
						<IconX size={13} />
					</button>
				)}
			</div>

			<div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
				{candidates.length === 0 ? (
					<div className="flex flex-col items-center gap-1 px-4 py-5 text-muted-foreground">
						<IconUserOff size={18} />
						<span className="text-[length:var(--m-text-footnote)]">
							{emptyLabel}
						</span>
					</div>
				) : (
					candidates.map((candidate) => (
						<CandidateRow
							candidate={candidate}
							isPicked={pickedKey === candidate.key}
							key={candidate.key}
							onPick={onPick}
						/>
					))
				)}
			</div>
		</div>
	);
}
