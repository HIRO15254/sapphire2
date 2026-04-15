import { useForm } from "@tanstack/react-form";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { type EditorBaseProps, type SessionType, TimeField } from "./shared";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onTimeUpdate"
> & {
	sessionType: SessionType;
};

export function SessionEndEditor({
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
			typeof payload.cashOutAmount === "number" ? (
				<Field htmlFor="edit-cashOutAmount" label="Cash-out Amount">
					<Input
						disabled
						id="edit-cashOutAmount"
						readOnly
						type="text"
						value={payload.cashOutAmount.toLocaleString()}
					/>
				</Field>
			) : null}
			{sessionType === "tournament" && (
				<>
					{typeof payload.placement === "number" ? (
						<Field htmlFor="edit-placement" label="Placement">
							<Input
								disabled
								id="edit-placement"
								readOnly
								type="text"
								value={String(payload.placement)}
							/>
						</Field>
					) : null}
					{typeof payload.totalEntries === "number" ? (
						<Field htmlFor="edit-totalEntries" label="Total Entries">
							<Input
								disabled
								id="edit-totalEntries"
								readOnly
								type="text"
								value={String(payload.totalEntries)}
							/>
						</Field>
					) : null}
					{typeof payload.prizeMoney === "number" ? (
						<Field htmlFor="edit-prizeMoney" label="Prize Money">
							<Input
								disabled
								id="edit-prizeMoney"
								readOnly
								type="text"
								value={payload.prizeMoney.toLocaleString()}
							/>
						</Field>
					) : null}
					{typeof payload.bountyPrizes === "number" ? (
						<Field htmlFor="edit-bountyPrizes" label="Bounty Prizes">
							<Input
								disabled
								id="edit-bountyPrizes"
								readOnly
								type="text"
								value={payload.bountyPrizes.toLocaleString()}
							/>
						</Field>
					) : null}
				</>
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
