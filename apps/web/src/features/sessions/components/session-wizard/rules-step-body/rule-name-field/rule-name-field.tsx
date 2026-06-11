import { OverrideLabel } from "@/features/sessions/components/override-label";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { UseSessionWizardReturn } from "../../use-session-wizard";

export function RuleNameField({
	state,
	isLiveLinked,
	overriddenLabels,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
	overriddenLabels?: ReadonlySet<string>;
}) {
	return (
		<state.form.Field name="ruleName">
			{(field) => (
				<Field
					htmlFor={field.name}
					label={
						<OverrideLabel label="Rule name" overridden={overriddenLabels} />
					}
				>
					<Input
						disabled={isLiveLinked}
						id={field.name}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						value={field.state.value}
					/>
				</Field>
			)}
		</state.form.Field>
	);
}
