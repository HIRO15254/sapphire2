import { useForm } from "@tanstack/react-form";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	TimeField,
	toTimeInputValue,
	validateOccurredAtTime,
	toOccurredAtTimestamp,
	type EditorBaseProps,
	type SessionType,
} from "./shared";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onTimeUpdate"
> & {
	sessionType: SessionType;
};

export function SessionStartEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onTimeUpdate,
	sessionType,
}: Props) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

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
			{sessionType === "cash_game" &&
			typeof payload.buyInAmount === "number" ? (
				<Field htmlFor="edit-buyInAmount" label="Buy-in Amount">
					<Input
						disabled
						id="edit-buyInAmount"
						readOnly
						type="text"
						value={payload.buyInAmount.toLocaleString()}
					/>
				</Field>
			) : null}
			<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
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
