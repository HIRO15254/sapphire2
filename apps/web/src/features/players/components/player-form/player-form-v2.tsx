import { PlayerTagInput } from "@/features/players/components/player-tag-input";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { RichTextEditor } from "@/shared/components/ui/rich-text-editor";
import type { PlayerFormValues } from "./player-form";
import { usePlayerForm } from "./use-player-form";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface PlayerFormV2Props {
	availableTags?: TagWithColor[];
	defaultMemo?: string | null;
	defaultTags?: TagWithColor[];
	defaultValues?: { name: string };
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (rendered by the surrounding FormSheet toolbar) can submit it via the
	 * HTML `form` attribute. The V2 form therefore renders no submit button of
	 * its own — see `.claude/rules/web-theme.md`.
	 */
	formId: string;
	onCreateTag?: (name: string) => Promise<TagWithColor>;
	onSubmit: (values: PlayerFormValues) => void;
}

export function PlayerFormV2({
	availableTags,
	defaultMemo,
	defaultTags,
	defaultValues,
	formId,
	onCreateTag,
	onSubmit,
}: PlayerFormV2Props) {
	const { form } = usePlayerForm({
		defaultMemo,
		defaultTags,
		defaultValues,
		onSubmit,
	});

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Player name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			{availableTags && (
				<form.Field name="tags">
					{(field) => (
						<Field label="Tags">
							<PlayerTagInput
								availableTags={availableTags}
								onAdd={(tag) => field.handleChange([...field.state.value, tag])}
								onCreateTag={onCreateTag}
								onRemove={(tag) =>
									field.handleChange(
										field.state.value.filter((t) => t.id !== tag.id)
									)
								}
								selectedTags={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			)}

			<form.Field name="memo">
				{(field) => (
					<Field label="Memo">
						<RichTextEditor
							initialContent={field.state.value ?? undefined}
							onChange={(html) => field.handleChange(html || null)}
						/>
					</Field>
				)}
			</form.Field>
		</form>
	);
}
