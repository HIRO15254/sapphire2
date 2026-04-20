import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";
import { type EditorBaseProps, type SessionType, TimeField } from "./shared";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit"
> & {
	sessionType: SessionType;
};

const cashGameEndSchema = z.object({
	time: z.string(),
	cashOutAmount: requiredNumericString({ integer: true, min: 0 }),
});

const tournamentEndSchema = z
	.object({
		time: z.string(),
		beforeDeadline: z.boolean(),
		placement: z.string(),
		totalEntries: z.string(),
		prizeMoney: requiredNumericString({ integer: true, min: 0 }),
		bountyPrizes: optionalNumericString({ integer: true, min: 0 }),
	})
	.superRefine((data, ctx) => {
		if (!data.beforeDeadline) {
			const placementResult = requiredNumericString({
				integer: true,
				min: 1,
			}).safeParse(data.placement);
			if (!placementResult.success) {
				for (const issue of placementResult.error.issues) {
					ctx.addIssue({ ...issue, path: ["placement"] });
				}
			}
			const totalEntriesResult = requiredNumericString({
				integer: true,
				min: 1,
			}).safeParse(data.totalEntries);
			if (!totalEntriesResult.success) {
				for (const issue of totalEntriesResult.error.issues) {
					ctx.addIssue({ ...issue, path: ["totalEntries"] });
				}
			}
		}
	});

function CashGameEndEditor({
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
			cashOutAmount:
				typeof payload.cashOutAmount === "number"
					? String(payload.cashOutAmount)
					: "0",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit({ cashOutAmount: Number(value.cashOutAmount) }, occurredAt);
		},
		validators: {
			onSubmit: cashGameEndSchema,
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
			<form.Field name="cashOutAmount">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Cash-out Amount"
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

function TournamentEndEditor({
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
			beforeDeadline: payload.beforeDeadline === true,
			placement:
				typeof payload.placement === "number"
					? String(payload.placement)
					: "",
			totalEntries:
				typeof payload.totalEntries === "number"
					? String(payload.totalEntries)
					: "",
			prizeMoney:
				typeof payload.prizeMoney === "number"
					? String(payload.prizeMoney)
					: "0",
			bountyPrizes:
				typeof payload.bountyPrizes === "number" && payload.bountyPrizes > 0
					? String(payload.bountyPrizes)
					: "",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			if (value.beforeDeadline) {
				onSubmit(
					{
						beforeDeadline: true,
						prizeMoney: Number(value.prizeMoney),
						bountyPrizes: value.bountyPrizes ? Number(value.bountyPrizes) : 0,
					},
					occurredAt
				);
			} else {
				onSubmit(
					{
						beforeDeadline: false,
						placement: Number(value.placement),
						totalEntries: Number(value.totalEntries),
						prizeMoney: Number(value.prizeMoney),
						bountyPrizes: value.bountyPrizes ? Number(value.bountyPrizes) : 0,
					},
					occurredAt
				);
			}
		},
		validators: {
			onSubmit: tournamentEndSchema,
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
			<div className="flex items-center gap-2">
				<form.Field name="beforeDeadline">
					{(field) => (
						<>
							<Checkbox
								checked={field.state.value}
								id={field.name}
								onCheckedChange={(checked) =>
									field.handleChange(checked === true)
								}
							/>
							<Label htmlFor={field.name}>
								Completed before registration deadline
							</Label>
						</>
					)}
				</form.Field>
			</div>
			<form.Subscribe selector={(state) => state.values.beforeDeadline}>
				{(beforeDeadline) =>
					!beforeDeadline && (
						<div className="grid grid-cols-2 gap-2">
							<form.Field name="placement">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={field.name}
										label="Placement"
										required
									>
										<Input
											id={field.name}
											inputMode="numeric"
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="1"
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>
							<form.Field name="totalEntries">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={field.name}
										label="Total Entries"
										required
									>
										<Input
											id={field.name}
											inputMode="numeric"
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="100"
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>
						</div>
					)
				}
			</form.Subscribe>
			<form.Field name="prizeMoney">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Prize Money"
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
			<form.Field name="bountyPrizes">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Bounty Prizes"
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

export function SessionEndEditor(props: Props) {
	if (props.sessionType === "cash_game") {
		return <CashGameEndEditor {...props} />;
	}
	return <TournamentEndEditor {...props} />;
}
