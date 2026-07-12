import { OverrideLabel } from "@/features/sessions/components/override-label";
import { cashOverriddenFields } from "@/features/sessions/utils/session-form-helpers";
import { MixFormSheet } from "@/shared/components/mix-form-sheet";
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
							isMixValue={state.isMixValue}
							onCurrencyChange={state.setSelectedCurrencyId}
							onVariantChange={state.onVariantChange}
							overriddenLabels={overriddenLabels}
							selectedCurrencyId={state.selectedCurrencyId}
						/>
						{state.isMixValue(values.variant) && (
							<>
								{/* Amounts only — the composition follows the mix master,
								    edited via the dedicated bottom sheet below. */}
								<MixGamesEditor
									disabled={isLiveLinked}
									onChange={state.setMixGames}
									onEditMix={
										state.mixRowFor(values.variant) && !isLiveLinked
											? () => state.onEditMix(values.variant)
											: undefined
									}
									resolveGroup={state.groupFor}
									value={state.mixGames}
								/>
								<MixFormSheet
									editingMix={state.editingMix}
									key={
										state.editingMix ? `edit-${state.editingMix.id}` : "closed"
									}
									onOpenChange={state.setIsMixSheetOpen}
									onSaved={state.onMixSaved}
									open={state.isMixSheetOpen}
									variants={state.variants}
								/>
							</>
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
