import { IconFilter } from "@tabler/icons-react";
import { useState } from "react";
import { ColorBadge } from "@/components/players/color-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogActionRow } from "@/components/ui/dialog-action-row";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface TagItem {
	color: string;
	id: string;
	name: string;
}

interface PlayerFiltersProps {
	availableTags: TagItem[];
	onTagIdsChange: (tagIds: string[]) => void;
	selectedTagIds: string[];
}

export function PlayerFilters({
	availableTags,
	onTagIdsChange,
	selectedTagIds,
}: PlayerFiltersProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [draft, setDraft] = useState<string[]>(selectedTagIds);

	const handleOpen = () => {
		setDraft(selectedTagIds);
		setIsOpen(true);
	};

	const toggleTag = (tagId: string) => {
		setDraft((prev) =>
			prev.includes(tagId)
				? prev.filter((id) => id !== tagId)
				: [...prev, tagId]
		);
	};

	const handleApply = () => {
		onTagIdsChange(draft);
		setIsOpen(false);
	};

	const handleReset = () => {
		setDraft([]);
		onTagIdsChange([]);
		setIsOpen(false);
	};

	return (
		<>
			<Button
				className="relative"
				onClick={handleOpen}
				size="sm"
				variant="outline"
			>
				<IconFilter size={16} />
				Filter
				{selectedTagIds.length > 0 && (
					<Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">
						{selectedTagIds.length}
					</Badge>
				)}
			</Button>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setIsOpen(false);
					}
				}}
				open={isOpen}
				title="Filter by Tags"
			>
				<div className="flex flex-col gap-4">
					{availableTags.length === 0 ? (
						<EmptyState
							className="border-none bg-transparent px-0 py-4"
							description="Create tags first."
							heading="No tags available"
						/>
					) : (
						<div className="flex flex-wrap gap-2">
							{availableTags.map((tag) => {
								const isSelected = draft.includes(tag.id);
								return (
									<button
										aria-pressed={isSelected}
										className={`rounded-full border-2 p-0.5 transition-colors ${isSelected ? "border-foreground" : "border-transparent"}`}
										key={tag.id}
										onClick={() => toggleTag(tag.id)}
										type="button"
									>
										<ColorBadge color={tag.color}>{tag.name}</ColorBadge>
									</button>
								);
							})}
						</div>
					)}
					<DialogActionRow className="sm:justify-stretch">
						<Button className="flex-1" onClick={handleReset} variant="outline">
							Reset
						</Button>
						<Button className="flex-1" onClick={handleApply}>
							Apply
						</Button>
					</DialogActionRow>
				</div>
			</ResponsiveDialog>
		</>
	);
}
