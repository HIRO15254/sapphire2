import { TournamentResultFields } from "../tournament-fields";
import type { UseSessionWizardReturn } from "../use-session-wizard";
import { CashResultFields } from "./cash-result-fields";
import { DateTimeFields } from "./date-time-fields";
import { TagsAndMemo } from "./tags-and-memo";

const NO_DISABLED_FIELDS: ReadonlySet<string> = new Set();
const NO_REQUIRED_FIELDS: ReadonlySet<string> = new Set();

export function ResultStepBody({
	state,
	tags,
	onCreateTag,
	disabledFields = NO_DISABLED_FIELDS,
	endDateHint,
	requiredFields = NO_REQUIRED_FIELDS,
	startDateHint,
}: {
	disabledFields?: ReadonlySet<string>;
	endDateHint?: string | null;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	requiredFields?: ReadonlySet<string>;
	startDateHint?: string | null;
	state: UseSessionWizardReturn;
	tags?: Array<{ id: string; name: string }>;
}) {
	return (
		<>
			<DateTimeFields
				disabledFields={disabledFields}
				endDateHint={endDateHint}
				requiredFields={requiredFields}
				startDateHint={startDateHint}
				state={state}
			/>
			{state.isCashGame ? (
				<CashResultFields disabledFields={disabledFields} state={state} />
			) : (
				<TournamentResultFields
					chipPurchaseCounts={state.chipPurchaseCounts}
					chipPurchases={state.chipPurchases}
					disabledFields={disabledFields}
					form={state.form}
					onChipPurchaseCountChange={state.updateChipPurchaseCount}
					requiredFields={requiredFields}
				/>
			)}
			<TagsAndMemo onCreateTag={onCreateTag} state={state} tags={tags} />
		</>
	);
}
