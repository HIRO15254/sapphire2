import { useSessionTags } from "@/sessions/hooks/use-session-tags";
import { TagManager } from "@/shared/components/management/tag-manager";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

function SessionTagForm({
	defaultValue,
	isLoading,
	onSubmit,
}: {
	defaultValue?: string;
	isLoading?: boolean;
	onSubmit: (name: string) => void;
}) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		onSubmit(name);
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="tag-name" label="Tag Name" required>
				<Input
					defaultValue={defaultValue}
					id="tag-name"
					maxLength={50}
					minLength={1}
					name="name"
					placeholder="Enter tag name"
					required
				/>
			</Field>
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}

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
				<SessionTagForm
					isLoading={isCreatePending}
					onSubmit={(name) => create(name).then(onClose)}
				/>
			)}
			renderDeleteDescription={(tag) => (
				<p className="text-sm">
					Are you sure you want to delete the tag &ldquo;{tag.name}&rdquo;?
					This will remove it from all sessions.
				</p>
			)}
			renderEditForm={(tag, onClose) => (
				<SessionTagForm
					defaultValue={tag.name}
					isLoading={isUpdatePending}
					onSubmit={(name) => update({ id: tag.id, name }).then(onClose)}
				/>
			)}
			tags={tags}
		/>
	);
}
