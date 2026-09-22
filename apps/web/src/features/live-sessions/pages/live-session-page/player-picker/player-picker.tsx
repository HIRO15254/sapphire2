import {
	IconUser,
	IconUserOff,
	IconUserPlus,
	IconUserQuestion,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { SearchPicker, SearchPickerRow } from "../search-picker";

export type PlayerPickerKind = "existing" | "new" | "temporary";

export interface PlayerPickerTag {
	color: string;
	id: string;
	name: string;
}

export interface PlayerPickerCandidate {
	key: string;
	kind: PlayerPickerKind;
	meta: string | null;
	name: string;
	tags: readonly PlayerPickerTag[];
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

const KIND_AVATAR = {
	existing: "bg-muted text-muted-foreground",
	new: "bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] text-primary",
	temporary:
		"bg-[color-mix(in_oklab,var(--warning)_18%,transparent)] text-warning",
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
		<SearchPickerRow
			className="min-h-14"
			isPicked={isPicked}
			onClick={() => onPick(candidate)}
		>
			<span
				className={cn(
					"inline-flex size-8 shrink-0 items-center justify-center rounded-full",
					KIND_AVATAR[candidate.kind]
				)}
			>
				<Icon size={16} />
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
				<span
					className={cn(
						"truncate font-medium text-[length:var(--m-text-secondary)] leading-[1.3]",
						candidate.kind === "temporary" && "text-warning"
					)}
				>
					{candidate.name}
				</span>
				{candidate.tags.length === 0 ? null : (
					<span className="flex min-w-0 flex-wrap items-center gap-[5px]">
						{candidate.tags.map((tag) => (
							<span
								className="inline-flex items-center rounded-full px-2 py-[3px] font-semibold text-[11px]"
								key={tag.id}
								style={{
									backgroundColor: `color-mix(in oklab, ${tag.color} 18%, transparent)`,
									color: tag.color,
								}}
							>
								{tag.name}
							</span>
						))}
					</span>
				)}
				{candidate.meta === null ? null : (
					<span className="truncate text-[length:var(--m-text-caption)] text-muted-foreground leading-[1.35]">
						{candidate.meta}
					</span>
				)}
			</span>
		</SearchPickerRow>
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
		<SearchPicker
			emptyIcon={IconUserOff}
			emptyLabel={emptyLabel}
			isDisabled={isDisabled}
			isEmpty={candidates.length === 0}
			onQueryChange={onQueryChange}
			query={query}
			searchLabel={searchLabel}
		>
			{candidates.map((candidate) => (
				<CandidateRow
					candidate={candidate}
					isPicked={pickedKey === candidate.key}
					key={candidate.key}
					onPick={onPick}
				/>
			))}
		</SearchPicker>
	);
}
