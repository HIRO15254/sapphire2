import {
	IconUser,
	IconUserOff,
	IconUserPlus,
	IconUserQuestion,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CRYST_TAG, CRYST_TAG_DOT } from "../cryst-controls";
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
	new: "bg-[var(--selection)] text-primary",
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
			className="min-h-12"
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
						"truncate font-medium leading-[1.3]",
						candidate.kind === "temporary" && "text-warning"
					)}
				>
					{candidate.name}
				</span>
				{candidate.tags.length === 0 ? null : (
					<span className="flex min-w-0 flex-wrap items-center gap-1">
						{candidate.tags.map((tag) => (
							<span className={CRYST_TAG} key={tag.id}>
								<span
									className={CRYST_TAG_DOT}
									style={{ backgroundColor: tag.color }}
								/>
								{tag.name}
							</span>
						))}
					</span>
				)}
				{candidate.meta === null ? null : (
					<span className="truncate text-[length:var(--text-xs)] text-muted-foreground leading-[1.35]">
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
