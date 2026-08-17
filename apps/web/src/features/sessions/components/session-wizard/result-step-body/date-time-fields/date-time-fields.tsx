import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { UseSessionWizardReturn } from "../../use-session-wizard";

export function DateTimeFields({
	state,
	disabledFields,
	endDateHint,
	requiredFields,
	startDateHint,
}: {
	disabledFields: ReadonlySet<string>;
	endDateHint?: string | null;
	requiredFields?: ReadonlySet<string>;
	startDateHint?: string | null;
	state: UseSessionWizardReturn;
}) {
	const { form } = state;
	return (
		<>
			<form.Field name="sessionDate">
				{(field) => (
					<Field htmlFor={field.name} label="Session date" required>
						<Input
							disabled={disabledFields.has("sessionDate")}
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							type="date"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="startTime">
					{(field) => (
						<Field
							description={
								startDateHint ? `Starts ${startDateHint}` : undefined
							}
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Start time"
							required={requiredFields?.has("startTime")}
						>
							<Input
								disabled={disabledFields.has("startTime")}
								id={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="time"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="endTime">
					{(field) => (
						<Field
							description={endDateHint ? `Ends ${endDateHint}` : undefined}
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="End time"
							required={requiredFields?.has("endTime")}
						>
							<Input
								disabled={disabledFields.has("endTime")}
								id={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="time"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>
			<form.Field name="breakMinutes">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Break time (min)"
					>
						<Input
							disabled={disabledFields.has("breakMinutes")}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</>
	);
}
