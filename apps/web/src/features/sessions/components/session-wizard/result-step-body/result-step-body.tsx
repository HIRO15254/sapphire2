import { TournamentResultFields } from "../tournament-fields";
import type { UseSessionWizardReturn } from "../use-session-wizard";
import { CashResultFields } from "./cash-result-fields";
import { DateTimeFields } from "./date-time-fields";
import { TagsAndMemo } from "./tags-and-memo";

export function ResultStepBody({
	state,
	tags,
	onCreateTag,
	isLiveLinked,
	allowPromote = false,
}: {
	state: UseSessionWizardReturn;
	tags?: Array<{ id: string; name: string }>;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	isLiveLinked: boolean;
	allowPromote?: boolean;
}) {
	return (
		<>
			<DateTimeFields isLiveLinked={isLiveLinked} state={state} />
			{state.isCashGame ? (
				<CashResultFields isLiveLinked={isLiveLinked} state={state} />
			) : (
				<TournamentResultFields
					allowPromote={allowPromote}
					chipPurchaseCounts={state.chipPurchaseCounts}
					chipPurchases={state.chipPurchases}
					form={state.form}
					isLiveLinked={isLiveLinked}
					onChipPurchaseCountChange={state.updateChipPurchaseCount}
				/>
			)}
			<TagsAndMemo onCreateTag={onCreateTag} state={state} tags={tags} />
		</>
	);
}
