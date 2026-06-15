import type { UseSessionWizardReturn } from "../use-session-wizard";
import { CashRulesStepBody } from "./cash-rules-step-body";
import { TournamentRulesStepBody } from "./tournament-rules-step-body";

export function RulesStepBody({
	state,
	currencies,
	isLiveLinked,
	showOverrides = true,
}: {
	state: UseSessionWizardReturn;
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
	/**
	 * Whether to flag fields that diverge from the picked master with a
	 * "Modified" badge. The wizard uses it to surface overrides; the live
	 * start form turns it off so the rule fields read like every other form.
	 */
	showOverrides?: boolean;
}) {
	if (state.isCashGame) {
		return (
			<CashRulesStepBody
				currencies={currencies}
				isLiveLinked={isLiveLinked}
				showOverrides={showOverrides}
				state={state}
			/>
		);
	}
	return (
		<TournamentRulesStepBody
			currencies={currencies}
			isLiveLinked={isLiveLinked}
			showOverrides={showOverrides}
			state={state}
		/>
	);
}
