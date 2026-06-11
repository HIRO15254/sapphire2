import { TagManager } from "@/shared/components/management/tag-manager";
import { TagNameForm } from "@/shared/components/management/tag-name-form";
import { useSessionTags } from "./use-session-tags";

export function SessionTagManager() {
	const {
		tags,
		create,
		update,
		delete: deleteTag,
		isCreatePending,
		isUpdatePending,
		isDeletePending,
	} = useSessionTags();

	return (
		<TagManager
			emptyDescription="Create tags when recording sessions."
			emptyHeading="No session tags yet"
			isCreatePending={isCreatePending}
			isDeletePending={isDeletePending}
			isEditPending={isUpdatePending}
			onDelete={deleteTag}
			renderCreateForm={(formId, onClose) => (
				<TagNameForm
					formId={formId}
					onSubmit={(name) => create(name).then(onClose)}
				/>
			)}
			renderDeleteDescription={(tag) => (
				<>
					Are you sure you want to delete the tag &ldquo;{tag.name}&rdquo;? This
					will remove it from all sessions.
				</>
			)}
			renderEditForm={(tag, formId, onClose) => (
				<TagNameForm
					defaultName={tag.name}
					formId={formId}
					onSubmit={(name) => update({ id: tag.id, name }).then(onClose)}
				/>
			)}
			tags={tags}
		/>
	);
}
