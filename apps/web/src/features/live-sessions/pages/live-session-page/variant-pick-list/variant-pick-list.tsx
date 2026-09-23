import { IconSearchOff } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CRYST_BADGE, CRYST_BADGE_TONE } from "../cryst-controls";
import { SearchPicker, SearchPickerRow } from "../search-picker";
import { useVariantPickList } from "./use-variant-pick-list";

interface VariantPickListProps {
	isDisabled?: (label: string) => boolean;
	isPicked: (label: string) => boolean;
	onPick: (label: string) => void;
}

const NEVER_DISABLED = () => false;

export function VariantPickList({
	isDisabled = NEVER_DISABLED,
	isPicked,
	onPick,
}: VariantPickListProps) {
	const list = useVariantPickList();

	return (
		<SearchPicker
			emptyIcon={IconSearchOff}
			emptyLabel="No matching game type"
			isEmpty={!list.isLoading && list.options.length === 0}
			onQueryChange={list.onQueryChange}
			query={list.query}
			searchLabel="Filter game types"
		>
			{list.options.map((option) => (
				<SearchPickerRow
					isDisabled={isDisabled(option.label)}
					isPicked={isPicked(option.label)}
					key={option.label}
					onClick={() => onPick(option.label)}
				>
					<span className="min-w-0 flex-1 truncate font-medium">
						{option.label}
					</span>
					{option.groupLabel === "" ? null : (
						<span className={cn(CRYST_BADGE, CRYST_BADGE_TONE.neutral)}>
							{option.groupLabel}
						</span>
					)}
					<span className="w-14 shrink-0 truncate text-right font-mono text-[length:var(--text-sm)] text-muted-foreground">
						{option.shortLabel ?? ""}
					</span>
				</SearchPickerRow>
			))}
		</SearchPicker>
	);
}
