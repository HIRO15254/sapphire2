import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { UseSessionWizardReturn } from "../use-session-wizard";

function CashStartStepBody({ state }: { state: UseSessionWizardReturn }) {
	const { form } = state;
	return (
		<form.Field name="buyIn">
			{(field) => (
				<Field
					error={field.state.meta.errors[0]?.message}
					htmlFor={field.name}
					label="Initial Buy-in"
					required
				>
					<Input
						id={field.name}
						inputMode="numeric"
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						value={field.state.value}
					/>
				</Field>
			)}
		</form.Field>
	);
}

function TournamentStartStepBody({ state }: { state: UseSessionWizardReturn }) {
	const { form } = state;
	return (
		<form.Field name="timerStartedAt">
			{(field) => (
				<Field htmlFor={field.name} label="Blind Timer Start">
					<Input
						id={field.name}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						type="datetime-local"
						value={field.state.value}
					/>
				</Field>
			)}
		</form.Field>
	);
}

export function StartStepBody({ state }: { state: UseSessionWizardReturn }) {
	return state.isCashGame ? (
		<CashStartStepBody state={state} />
	) : (
		<TournamentStartStepBody state={state} />
	);
}
