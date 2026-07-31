import {
	IconEdit,
	IconStar,
	IconStarFilled,
	IconTrash,
} from "@tabler/icons-react";
import {
	ManagementList,
	ManagementListItem,
} from "@/shared/components/management/management-list";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { FilterPresetItem } from "@/shared/hooks/use-filter-presets";

const SKELETON_ROW_COUNT = 3;

/** Mirrors `ManagementListItem`'s row: title line plus the three row actions. */
function SavedPresetsSkeleton() {
	return (
		<ManagementList aria-hidden data-testid="filter-presets-skeleton">
			{Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => i).map((i) => (
				<ManagementListItem
					actions={
						<div className="flex gap-1">
							<Skeleton className="size-8 rounded-md" />
							<Skeleton className="size-8 rounded-md" />
							<Skeleton className="size-8 rounded-md" />
						</div>
					}
					key={i}
					title={<Skeleton className="h-4 w-32" />}
				/>
			))}
		</ManagementList>
	);
}

/**
 * Owns the loading / empty / data switch for the saved-presets surface: the
 * skeleton comes first so a first open never claims "No saved presets yet"
 * while the list query is still in flight.
 */
export function SavedPresetsList({
	isLoading,
	isDefaultTogglePending,
	onApplyPreset,
	onRequestDelete,
	onRequestEdit,
	onToggleDefault,
	presets,
}: {
	isLoading: boolean;
	isDefaultTogglePending: boolean;
	onApplyPreset: (preset: FilterPresetItem) => void;
	onRequestDelete: (preset: FilterPresetItem) => void;
	onRequestEdit: (preset: FilterPresetItem) => void;
	onToggleDefault: (preset: FilterPresetItem) => void;
	presets: FilterPresetItem[];
}) {
	if (isLoading) {
		return <SavedPresetsSkeleton />;
	}
	if (presets.length === 0) {
		return (
			<EmptyState
				className="px-4 py-8"
				description="Save your current filters to reuse them later."
				heading="No saved presets yet"
			/>
		);
	}
	return (
		<ManagementList>
			{presets.map((preset) => (
				<ManagementListItem
					actions={
						<div className="flex gap-1">
							<Button
								aria-label={
									preset.isDefault
										? `Unset ${preset.name} as default`
										: `Set ${preset.name} as default`
								}
								disabled={isDefaultTogglePending}
								onClick={(e) => {
									e.stopPropagation();
									onToggleDefault(preset);
								}}
								size="sm"
								variant="ghost"
							>
								{preset.isDefault ? (
									<IconStarFilled size={16} />
								) : (
									<IconStar size={16} />
								)}
							</Button>
							<Button
								aria-label={`Rename ${preset.name} or overwrite it with the current filters`}
								onClick={(e) => {
									e.stopPropagation();
									onRequestEdit(preset);
								}}
								size="sm"
								variant="ghost"
							>
								<IconEdit size={16} />
							</Button>
							<Button
								aria-label={`Delete ${preset.name}`}
								onClick={(e) => {
									e.stopPropagation();
									onRequestDelete(preset);
								}}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={16} />
							</Button>
						</div>
					}
					key={preset.id}
					title={
						<button
							className="text-left"
							onClick={() => onApplyPreset(preset)}
							type="button"
						>
							{preset.name}
						</button>
					}
				/>
			))}
		</ManagementList>
	);
}
