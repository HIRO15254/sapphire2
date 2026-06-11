import { LocalBlindStructureContent } from "@/features/rooms/components/blind-level-editor";
import { ChipPurchasesEditor } from "@/features/rooms/components/chip-purchases-editor";
import { OverrideLabel } from "@/features/sessions/components/override-label";
import { tournamentOverriddenFields } from "@/features/sessions/utils/session-form-helpers";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { TournamentRuleFields } from "../../tournament-fields";
import type { UseSessionWizardReturn } from "../../use-session-wizard";
import { RuleNameField } from "../rule-name-field";

function TournamentSnapshotScalarFields({
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
			<form.Field name="startingStack">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label={
							<OverrideLabel
								label="Starting stack"
								overridden={overriddenLabels}
							/>
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
			<form.Field name="bountyAmount">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label={
							<OverrideLabel
								label="Bounty amount"
								overridden={overriddenLabels}
							/>
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

function TournamentSettingsTab({
	state,
	currencies,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
}) {
	return (
		<state.form.Subscribe selector={(s) => s.values}>
			{(values) => {
				const overriddenLabels = new Set(
					tournamentOverriddenFields(values, state.selectedTournament)
				);
				return (
					<div className="flex flex-col gap-3">
						<RuleNameField
							isLiveLinked={isLiveLinked}
							overriddenLabels={overriddenLabels}
							state={state}
						/>
						<TournamentRuleFields
							currencies={currencies}
							form={state.form}
							isLiveLinked={isLiveLinked}
							key={`tourney-rule-${state.selectedGameId ?? "none"}`}
							onCurrencyChange={state.setSelectedCurrencyId}
							overriddenLabels={overriddenLabels}
							selectedCurrencyId={state.selectedCurrencyId}
						/>
						<TournamentSnapshotScalarFields
							isLiveLinked={isLiveLinked}
							overriddenLabels={overriddenLabels}
							state={state}
						/>
						<ChipPurchasesEditor
							onChange={state.setChipPurchases}
							value={state.chipPurchases}
						/>
					</div>
				);
			}}
		</state.form.Subscribe>
	);
}

export function TournamentRulesStepBody({
	state,
	currencies,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
}) {
	return (
		<state.form.Subscribe selector={(s) => s.values.variant}>
			{(variant) => (
				<>
					<Tabs defaultValue="settings">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="settings">Settings</TabsTrigger>
							<TabsTrigger value="blinds">Blind levels</TabsTrigger>
						</TabsList>
						<TabsContent value="settings">
							<TournamentSettingsTab
								currencies={currencies}
								isLiveLinked={isLiveLinked}
								state={state}
							/>
						</TabsContent>
						<TabsContent value="blinds">
							<LocalBlindStructureContent
								onChange={state.setBlindLevels}
								value={state.blindLevels}
								variant={variant || "nlh"}
							/>
						</TabsContent>
					</Tabs>
				</>
			)}
		</state.form.Subscribe>
	);
}
