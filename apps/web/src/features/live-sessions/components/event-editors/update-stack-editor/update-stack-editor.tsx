import { UpdateStackFields } from "@/features/live-sessions/components/event-fields/update-stack-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { type EditorBaseProps, TimeField } from "../shared";
import { useUpdateStackEditor } from "./use-update-stack-editor";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit"
>;

export function UpdateStackEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: Props) {
	const { form, timeValidator } = useUpdateStackEditor({
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
			<form.Field name="stackAmount">
				{(field) => (
					<UpdateStackFields
						error={field.state.meta.errors[0]?.message}
						onStackAmountChange={(v) => field.handleChange(v)}
						value={field.state.value}
					/>
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
