import type { UseSessionWizardReturn } from "../use-session-wizard";
import { CashRulesStepBody } from "./cash-rules-step-body";
import { TournamentRulesStepBody } from "./tournament-rules-step-body";

export function RulesStepBody({
	state,
	currencies,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
}) {
	if (state.isCashGame) {
		return (
			<CashRulesStepBody
				currencies={currencies}
				isLiveLinked={isLiveLinked}
				state={state}
			/>
		);
	}
	return (
		<TournamentRulesStepBody
			currencies={currencies}
			isLiveLinked={isLiveLinked}
			state={state}
		/>
	);
}
