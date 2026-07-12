import { isMixVariant } from "@sapphire2/db/constants/game-variants";
import { OverrideLabel } from "@/features/sessions/components/override-label";
import { cashOverriddenFields } from "@/features/sessions/utils/session-form-helpers";
import { MixGamesEditor } from "@/shared/components/mix-games-editor";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { UseSessionWizardReturn } from "../../use-session-wizard";
import { RuleNameField } from "../rule-name-field";
import { CashGameFields } from "./cash-game-fields";

function CashBuyInBoundsFields({
	state,
	isLiveLinked,
	overriddenLabels,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
	overriddenLabels?: ReadonlySet<string>;
}) {
	const { form } = state;
	return (
		<div className="grid grid-cols-2 gap-3">
			<form.Field name="minBuyIn">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label={
							<OverrideLabel label="Min buy-in" overridden={overriddenLabels} />
						}
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
			<form.Field name="maxBuyIn">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label={
							<OverrideLabel label="Max buy-in" overridden={overriddenLabels} />
						}
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
		</div>
	);
}

export function CashRulesStepBody({
	state,
	currencies,
	isLiveLinked,
	showOverrides = true,
}: {
	state: UseSessionWizardReturn;
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
	showOverrides?: boolean;
}) {
	return (
		<state.form.Subscribe selector={(s) => s.values}>
			{(values) => {
				const overriddenLabels = showOverrides
					? new Set(cashOverriddenFields(values, state.selectedRingGame))
					: undefined;
				return (
					<>
						<RuleNameField
							isLiveLinked={isLiveLinked}
							overriddenLabels={overriddenLabels}
							state={state}
						/>
						<CashGameFields
							currencies={currencies}
							form={state.form}
							isLiveLinked={isLiveLinked}
							onCurrencyChange={state.setSelectedCurrencyId}
							overriddenLabels={overriddenLabels}
							selectedCurrencyId={state.selectedCurrencyId}
						/>
						{isMixVariant(values.variant) && (
							<MixGamesEditor
								disabled={isLiveLinked}
								onChange={state.setMixGames}
								resolveGroup={state.groupFor}
								resolveVariantLabel={state.resolveVariantLabel}
								value={state.mixGames}
							/>
						)}
						<CashBuyInBoundsFields
							isLiveLinked={isLiveLinked}
							overriddenLabels={overriddenLabels}
							state={state}
						/>
					</>
				);
			}}
		</state.form.Subscribe>
	);
}
