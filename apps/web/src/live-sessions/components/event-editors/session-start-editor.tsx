import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { requiredNumericString } from "@/shared/lib/form-fields";
import { type EditorBaseProps, type SessionType, TimeField } from "./shared";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit" | "onTimeUpdate"
> & {
	sessionType: SessionType;
};

const cashGameStartSchema = z.object({
	time: z.string(),
	buyInAmount: requiredNumericString({ integer: true, min: 0 }),
});

export function SessionStartEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
	onTimeUpdate,
	sessionType,
}: Props) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const isCashGame = sessionType === "cash_game";

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			buyInAmount:
				typeof payload.buyInAmount === "number"
					? String(payload.buyInAmount)
					: "0",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			if (isCashGame) {
				onSubmit({ buyInAmount: Number(value.buyInAmount) }, occurredAt);
			} else if (occurredAt !== undefined) {
				onTimeUpdate(occurredAt);
			}
		},
		validators: isCashGame ? { onSubmit: cashGameStartSchema } : undefined,
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
			{isCashGame && (
				<form.Field name="buyInAmount">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Buy-in Amount"
							required
						>
							<Input
								id={field.name}
								inputMode="numeric"
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="0"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			)}
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
