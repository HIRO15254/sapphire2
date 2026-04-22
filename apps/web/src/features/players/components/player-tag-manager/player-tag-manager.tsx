import { ColorBadge } from "@/features/players/components/color-badge";
import { TagColorPicker } from "@/features/players/components/tag-color-picker";
import type { TagColor } from "@/features/players/constants/player-tag-colors";
import {
	type TagFormValues,
	type TagItem,
	usePlayerTags,
} from "@/features/players/hooks/use-player-tags";
import { TagManager } from "@/shared/components/management/tag-manager";
import { TagNameForm } from "@/shared/components/management/tag-name-form";
import { Field } from "@/shared/components/ui/field";
import { useTagForm } from "./use-player-tag-manager";

function TagForm({
	defaultValues,
	isLoading,
	onSubmit,
}: {
	defaultValues?: TagFormValues;
	isLoading?: boolean;
	onSubmit: (values: TagFormValues) => void;
}) {
	const { selectedColor, onColorChange } = useTagForm({ defaultValues });

	return (
		<TagNameForm
			defaultName={defaultValues?.name}
			isLoading={isLoading}
			onSubmit={(name) => onSubmit({ name, color: selectedColor })}
		>
			<Field label="Color">
				<TagColorPicker onChange={onColorChange} value={selectedColor} />
			</Field>
		</TagNameForm>
	);
}

export function PlayerTagManager() {
	const {
		tags,
		create,
		update,
		delete: deleteTag,
		isCreatePending,
		isUpdatePending,
		isDeletePending,
	} = usePlayerTags();

	return (
		<TagManager<TagItem>
			emptyDescription="Create your first tag to categorize players."
			emptyHeading="No tags yet"
			isDeletePending={isDeletePending}
			onDelete={deleteTag}
			renderCreateForm={(onClose) => (
				<TagForm
					isLoading={isCreatePending}
					onSubmit={(values) => create(values).then(onClose)}
				/>
			)}
			renderDeleteDescription={(tag) => (
				<p className="text-sm">
					Are you sure you want to delete the tag{" "}
					<ColorBadge color={tag.color}>{tag.name}</ColorBadge>? This will
					remove it from all players.
				</p>
			)}
			renderEditForm={(tag, onClose) => (
				<TagForm
					defaultValues={{
						name: tag.name,
						color: tag.color as TagColor,
					}}
					isLoading={isUpdatePending}
					onSubmit={(values) => update({ id: tag.id, ...values }).then(onClose)}
				/>
			)}
			renderTagLabel={(tag) => (
				<ColorBadge color={tag.color}>{tag.name}</ColorBadge>
			)}
			tags={tags}
		/>
	);
}
