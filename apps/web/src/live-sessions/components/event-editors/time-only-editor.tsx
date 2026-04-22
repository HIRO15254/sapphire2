import { useTimeOnlyEditor } from "@/live-sessions/hooks/event-editors/use-time-only-editor";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { type EditorBaseProps, TimeField } from "./shared";

type TimeOnlyEditorProps = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onTimeUpdate"
>;

export function TimeOnlyEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onTimeUpdate,
}: TimeOnlyEditorProps) {
	const { form, timeValidator } = useTimeOnlyEditor({
		event,
		isLoading,
		maxTime,
		minTime,
		onTimeUpdate,
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
