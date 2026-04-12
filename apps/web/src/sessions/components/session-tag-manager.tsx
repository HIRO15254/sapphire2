import { useSessionTags } from "@/sessions/hooks/use-session-tags";
import { TagManager } from "@/shared/components/management/tag-manager";
import { TagNameForm } from "@/shared/components/management/tag-name-form";

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
			isDeletePending={isDeletePending}
			onDelete={deleteTag}
			renderCreateForm={(onClose) => (
				<TagNameForm
					isLoading={isCreatePending}
					onSubmit={(name) => create(name).then(onClose)}
				/>
			)}
			renderDeleteDescription={(tag) => (
				<p className="text-sm">
					Are you sure you want to delete the tag &ldquo;{tag.name}&rdquo;? This
					will remove it from all sessions.
				</p>
			)}
			renderEditForm={(tag, onClose) => (
				<TagNameForm
					defaultName={tag.name}
					isLoading={isUpdatePending}
					onSubmit={(name) => update({ id: tag.id, name }).then(onClose)}
				/>
			)}
			tags={tags}
		/>
	);
}
