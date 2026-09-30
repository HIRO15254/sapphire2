import { OverrideLabel } from "@/features/sessions/components/override-label";
import { HOUSE_RULES_LABEL } from "@/features/sessions/utils/session-form-helpers";
import { Field } from "@/shared/components/ui/field";
import { Textarea } from "@/shared/components/ui/textarea";
import type { UseSessionWizardReturn } from "../../use-session-wizard";

export function HouseRulesField({
	state,
	isLiveLinked,
	overriddenLabels,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
	overriddenLabels?: ReadonlySet<string>;
}) {
	if (state.mode === "live") {
		return null;
	}
	return (
		<state.form.Field name="houseRules">
			{(field) => (
				<Field
					htmlFor={field.name}
					label={
						<OverrideLabel
							label={HOUSE_RULES_LABEL}
							overridden={overriddenLabels}
						/>
					}
				>
					<Textarea
						disabled={isLiveLinked}
						id={field.name}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						rows={4}
						value={field.state.value}
					/>
				</Field>
			)}
		</state.form.Field>
	);
}
