import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { UseSessionWizardReturn } from "../../use-session-wizard";

export function DateTimeFields({
	state,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
}) {
	const { form } = state;
	return (
		<>
			<form.Field name="sessionDate">
				{(field) => (
					<Field htmlFor={field.name} label="Session Date" required>
						<Input
							disabled={isLiveLinked}
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
						<Field htmlFor={field.name} label="Start Time">
							<Input
								disabled={isLiveLinked}
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
						<Field htmlFor={field.name} label="End Time">
							<Input
								disabled={isLiveLinked}
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
						label="Break Time (min)"
					>
						<Input
							disabled={isLiveLinked}
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
