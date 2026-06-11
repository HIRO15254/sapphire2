import { Field } from "@/shared/components/ui/field";
import { TagInput } from "@/shared/components/ui/tag-input";
import { Textarea } from "@/shared/components/ui/textarea";
import type { UseSessionWizardReturn } from "../../use-session-wizard";

export function TagsAndMemo({
	state,
	tags,
	onCreateTag,
}: {
	state: UseSessionWizardReturn;
	tags?: Array<{ id: string; name: string }>;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
}) {
	return (
		<>
			<Field label="Session Tags">
				<TagInput
					availableTags={tags}
					onAdd={(tag) => state.setSelectedTagIds((prev) => [...prev, tag.id])}
					onCreateTag={onCreateTag}
					onRemove={(tag) =>
						state.setSelectedTagIds((prev) =>
							prev.filter((id) => id !== tag.id)
						)
					}
					selectedTags={state.selectedTagIds
						.map((id) => tags?.find((t) => t.id === id))
						.filter((t): t is { id: string; name: string } => t !== undefined)}
				/>
			</Field>
			<state.form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</state.form.Field>
		</>
	);
}
