import { useEffect, useRef, useState } from "react";
import { ColorBadge } from "@/players/components/color-badge";
import { PlayerTagInput } from "@/players/components/player-tag-input";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { RichTextEditor } from "@/shared/components/ui/rich-text-editor";

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
				<Field label="Tags">
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
				</Field>
				<Field label="Memo">
					<RichTextEditor
						initialContent={player?.memo}
						onChange={handleMemoChange}
					/>
				</Field>
				<DialogActionRow>
					<Button
						className="border-destructive text-destructive hover:bg-destructive/10"
						onClick={onRemove}
						type="button"
						variant="outline"
					>
						Remove from table
					</Button>
					<Button disabled={isSaving} onClick={handleSave} type="button">
						{isSaving ? "Saving..." : "Save"}
					</Button>
				</DialogActionRow>
			</div>
		</ResponsiveDialog>
	);
}
