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

const tournamentStartSchema = z.object({
	time: z.string(),
	timerStartedAt: z.string(),
});

function toDatetimeLocalValue(value: Date | string | number | null): string {
	if (value === null || value === undefined) {
		return "";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toTimerSeconds(value: string): number | null {
	if (!value) {
		return null;
	}
	const ms = new Date(value).getTime();
	if (Number.isNaN(ms)) {
		return null;
	}
	return Math.floor(ms / 1000);
}

function CashGameStartEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: Props) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

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
			onSubmit({ buyInAmount: Number(value.buyInAmount) }, occurredAt);
		},
		validators: {
			onSubmit: cashGameStartSchema,
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

function TournamentStartEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: Props) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const initialTimer =
		typeof payload.timerStartedAt === "number"
			? toDatetimeLocalValue(payload.timerStartedAt * 1000)
			: "";

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			timerStartedAt: initialTimer,
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{ timerStartedAt: toTimerSeconds(value.timerStartedAt) },
				occurredAt
			);
		},
		validators: {
			onSubmit: tournamentStartSchema,
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
			<form.Field name="timerStartedAt">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Blind Timer Start"
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							step={60}
							type="datetime-local"
							value={field.state.value}
						/>
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

export function SessionStartEditor(props: Props) {
	if (props.sessionType === "cash_game") {
		return <CashGameStartEditor {...props} />;
	}
	return <TournamentStartEditor {...props} />;
}
