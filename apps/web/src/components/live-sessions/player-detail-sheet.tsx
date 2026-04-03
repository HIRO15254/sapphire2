import { useEffect, useRef, useState } from "react";
import { ColorBadge } from "@/components/players/color-badge";
import { PlayerTagInput } from "@/components/players/player-tag-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface PlayerDetailSheetProps {
	availableTags: TagWithColor[];
	isSaving: boolean;
	onCreateTag?: (name: string) => Promise<TagWithColor>;
	onOpenChange: (open: boolean) => void;
	onRemove: () => void;
	onSave: (values: { memo?: string | null; tagIds?: string[] }) => void;
	open: boolean;
	player: {
		id: string;
		memo: string | null;
		name: string;
		tags: TagWithColor[];
	} | null;
}

export function PlayerDetailSheet({
	availableTags,
	isSaving,
	onCreateTag,
	onOpenChange,
	onRemove,
	onSave,
	open,
	player,
}: PlayerDetailSheetProps) {
	const [selectedTags, setSelectedTags] = useState<TagWithColor[]>(
		player?.tags ?? []
	);
	const memoRef = useRef<string | null>(player?.memo ?? null);

	useEffect(() => {
		if (open) {
			setSelectedTags(player?.tags ?? []);
			memoRef.current = player?.memo ?? null;
		}
	}, [open, player]);

	const handleMemoChange = (html: string) => {
		memoRef.current = html || null;
	};

	const handleSave = () => {
		onSave({
			memo: memoRef.current,
			tagIds: selectedTags.map((t) => t.id),
		});
	};

	return (
		<ResponsiveDialog
			fullHeight
			onOpenChange={onOpenChange}
			open={open}
			title={player?.name ?? "Player"}
		>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<Label>Tags</Label>
					{selectedTags.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{selectedTags.map((tag) => (
								<ColorBadge color={tag.color} key={tag.id}>
									{tag.name}
								</ColorBadge>
							))}
						</div>
					)}
					<PlayerTagInput
						availableTags={availableTags}
						onAdd={(tag) => setSelectedTags((prev) => [...prev, tag])}
						onCreateTag={onCreateTag}
						onRemove={(tag) =>
							setSelectedTags((prev) => prev.filter((t) => t.id !== tag.id))
						}
						selectedTags={selectedTags}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label>Memo</Label>
					<RichTextEditor
						initialContent={player?.memo}
						onChange={handleMemoChange}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Button disabled={isSaving} onClick={handleSave} type="button">
						{isSaving ? "Saving..." : "Save"}
					</Button>
					<Button
						className="border-destructive text-destructive hover:bg-destructive/10"
						onClick={onRemove}
						type="button"
						variant="outline"
					>
						Remove from table
					</Button>
				</div>
			</div>
		</ResponsiveDialog>
	);
}
