import { useForm } from "@tanstack/react-form";
import type { ReactNode } from "react";
import z from "zod";
import { PlayerTagInput } from "@/players/components/player-tag-input";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { RichTextEditor } from "@/shared/components/ui/rich-text-editor";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

export interface PlayerFormValues {
	memo?: string | null;
	name: string;
	tagIds?: string[];
}

interface PlayerFormProps {
	availableTags?: TagWithColor[];
	defaultMemo?: string | null;
	defaultTags?: TagWithColor[];
	defaultValues?: { name: string };
	isLoading?: boolean;
	leadingActions?: ReactNode;
	onCreateTag?: (name: string) => Promise<TagWithColor>;
	onSubmit: (values: PlayerFormValues) => void;
}

const playerFormSchema = z.object({
	memo: z.string().max(50_000).nullable(),
	name: z
		.string()
		.min(1, "Name is required")
		.max(100, "Name must be 100 characters or less"),
	tags: z.array(
		z.object({ color: z.string(), id: z.string(), name: z.string() })
	),
});

export function PlayerForm({
	availableTags,
	defaultMemo,
	defaultTags,
	defaultValues,
	isLoading = false,
	leadingActions,
	onCreateTag,
	onSubmit,
}: PlayerFormProps) {
	const form = useForm({
		defaultValues: {
			memo: defaultMemo ?? (null as string | null),
			name: defaultValues?.name ?? "",
			tags: defaultTags ?? ([] as TagWithColor[]),
		},
		onSubmit: ({ value }) => {
			onSubmit({
				memo: value.memo,
				name: value.name,
				tagIds: value.tags.length > 0 ? value.tags.map((t) => t.id) : undefined,
			});
		},
		validators: {
			onSubmit: playerFormSchema,
		},
	});

	return (
		<form
			className="flex flex-col gap-4"
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
						label="Player Name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Enter player name"
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

			<form.Subscribe>
				{(state) => {
					const saveButton = (
						<Button
							disabled={isLoading || !state.canSubmit || state.isSubmitting}
							type="submit"
						>
							{isLoading || state.isSubmitting ? "Saving..." : "Save"}
						</Button>
					);

					return leadingActions ? (
						<DialogActionRow>
							{leadingActions}
							{saveButton}
						</DialogActionRow>
					) : (
						saveButton
					);
				}}
			</form.Subscribe>
		</form>
	);
}
