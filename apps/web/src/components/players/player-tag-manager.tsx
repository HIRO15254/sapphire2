import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import {
	ManagementList,
	ManagementListItem,
} from "@/components/management/management-list";
import { ColorBadge } from "@/components/players/color-badge";
import { Button } from "@/components/ui/button";
import { DialogActionRow } from "@/components/ui/dialog-action-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TAG_COLOR_NAMES, type TagColor } from "@/constants/player-tag-colors";
import {
	type TagFormValues,
	type TagItem,
	usePlayerTags,
} from "@/hooks/use-player-tags";

function TagForm({
	defaultValues,
	isLoading,
	onSubmit,
}: {
	defaultValues?: TagFormValues;
	isLoading?: boolean;
	onSubmit: (values: TagFormValues) => void;
}) {
	const [selectedColor, setSelectedColor] = useState<TagColor>(
		defaultValues?.color ?? "gray"
	);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		onSubmit({ name, color: selectedColor });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="tag-name" label="Tag Name" required>
				<Input
					defaultValue={defaultValues?.name}
					id="tag-name"
					maxLength={50}
					minLength={1}
					name="name"
					placeholder="Enter tag name"
					required
				/>
			</Field>
			<Field label="Color">
				<ToggleGroup
					onValueChange={(value) => {
						if (value) {
							setSelectedColor(value as TagColor);
						}
					}}
					type="single"
					value={selectedColor}
				>
					{TAG_COLOR_NAMES.map((color) => (
						<ToggleGroupItem
							aria-label={`Select ${color} color`}
							key={color}
							size="sm"
							value={color}
						>
							<ColorBadge color={color}>{color}</ColorBadge>
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</Field>
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}

export function PlayerTagManager() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTag, setEditingTag] = useState<TagItem | null>(null);
	const [deletingTag, setDeletingTag] = useState<TagItem | null>(null);

	const { tags, create, update, delete: deleteTag, isCreatePending, isUpdatePending, isDeletePending } = usePlayerTags();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">
					{tags.length} {tags.length === 1 ? "tag" : "tags"}
				</p>
				<Button onClick={() => setIsCreateOpen(true)} size="sm">
					<IconPlus size={16} />
					New Tag
				</Button>
			</div>

			{tags.length === 0 ? (
				<EmptyState
					className="border-none bg-transparent px-0 py-8"
					description="Create your first tag to categorize players."
					heading="No tags yet"
				/>
			) : (
				<ManagementList>
					{tags.map((tag) => (
						<ManagementListItem
							actions={
								<div className="flex gap-1">
									<Button
										aria-label={`Edit tag ${tag.name}`}
										onClick={() => setEditingTag(tag)}
										size="sm"
										variant="ghost"
									>
										<IconEdit size={16} />
									</Button>
									<Button
										aria-label={`Delete tag ${tag.name}`}
										onClick={() => setDeletingTag(tag)}
										size="sm"
										variant="ghost"
									>
										<IconTrash size={16} />
									</Button>
								</div>
							}
							key={tag.id}
							title={<ColorBadge color={tag.color}>{tag.name}</ColorBadge>}
						/>
					))}
				</ManagementList>
			)}

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="New Tag"
			>
				<TagForm
					isLoading={isCreatePending}
					onSubmit={(values) => create(values).then(() => setIsCreateOpen(false))}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingTag(null);
					}
				}}
				open={editingTag !== null}
				title="Edit Tag"
			>
				{editingTag && (
					<TagForm
						defaultValues={{
							name: editingTag.name,
							color: editingTag.color as TagColor,
						}}
						isLoading={isUpdatePending}
						onSubmit={(values) =>
							update({ id: editingTag.id, ...values }).then(() => setEditingTag(null))
						}
					/>
				)}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setDeletingTag(null);
					}
				}}
				open={deletingTag !== null}
				title="Delete Tag"
			>
				{deletingTag && (
					<div className="flex flex-col gap-4">
						<p className="text-sm">
							Are you sure you want to delete the tag{" "}
							<ColorBadge color={deletingTag.color}>
								{deletingTag.name}
							</ColorBadge>
							? This will remove it from all players.
						</p>
						<DialogActionRow>
							<Button onClick={() => setDeletingTag(null)} variant="outline">
								Cancel
							</Button>
							<Button
								disabled={isDeletePending}
								onClick={() => deleteTag(deletingTag.id).then(() => setDeletingTag(null))}
								variant="destructive"
							>
								{isDeletePending ? "Deleting..." : "Delete"}
							</Button>
						</DialogActionRow>
					</div>
				)}
			</ResponsiveDialog>
		</div>
	);
}
