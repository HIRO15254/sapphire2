import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { UseSessionWizardReturn } from "../../use-session-wizard";

export function CashResultFields({
	state,
	disabledFields,
}: {
	disabledFields: ReadonlySet<string>;
	state: UseSessionWizardReturn;
}) {
	const { form } = state;
	return (
		<>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="buyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Buy-in"
							required
						>
							<Input
								disabled={disabledFields.has("buyIn")}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="cashOut">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Cash-out"
							required
						>
							<Input
								disabled={disabledFields.has("cashOut")}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>
			<form.Field name="evCashOut">
				{(field) => (
					<Field htmlFor={field.name} label="EV cash-out">
						<Input
							disabled={disabledFields.has("evCashOut")}
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
