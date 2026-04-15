import { useForm } from "@tanstack/react-form";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";
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
	const form = useForm({
		defaultValues: { time: toTimeInputValue(event.occurredAt) },
		onSubmit: ({ value }) => {
			const ts = toOccurredAtTimestamp(event.occurredAt, value.time);
			if (ts !== undefined) {
				onTimeUpdate(ts);
			}
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
			<form.Field
				name="time"
				validators={{
					onChange: ({ value }) =>
						validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
						undefined,
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
