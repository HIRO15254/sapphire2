import { AddonFields } from "@/live-sessions/components/event-fields/addon-fields";
import { useChipsAddRemoveEditor } from "@/live-sessions/hooks/event-editors/use-chips-add-remove-editor";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import { type EditorBaseProps, TimeField } from "./shared";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit"
>;

export function ChipsAddRemoveEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: Props) {
	const { form, timeValidator } = useChipsAddRemoveEditor({
		event,
		isLoading,
		maxTime,
		minTime,
		onSubmit,
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
			<form.Field
				name="time"
				validators={{
					onChange: ({ value }) => timeValidator(value),
				}}
			>
				{(field) => (
					<TimeField
						error={field.state.meta.errors[0]?.toString() ?? null}
						onChange={(v) => field.handleChange(v)}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="amount">
				{(field) => (
					<AddonFields
						error={field.state.meta.errors[0]?.message}
						onAmountChange={(v) => field.handleChange(v)}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<form.Field name="type">
				{(field) => (
					<Field htmlFor="edit-type" label="Type">
						<ToggleGroup
							onValueChange={(val) => {
								if (val) {
									field.handleChange(val as "add" | "remove");
								}
							}}
							type="single"
							value={field.state.value}
						>
							<ToggleGroupItem value="add">Add</ToggleGroupItem>
							<ToggleGroupItem value="remove">Remove</ToggleGroupItem>
						</ToggleGroup>
					</Field>
				)}
			</form.Field>
			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, isSubmitting]) => (
					<DialogActionRow>
						<Button
							disabled={!canSubmit || isSubmitting || isLoading}
							type="submit"
						>
							{isLoading ? "Saving..." : "Save"}
						</Button>
					</DialogActionRow>
				)}
			</form.Subscribe>
		</form>
	);
}
