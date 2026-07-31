import { TournamentResultFields } from "../tournament-fields";
import type { UseSessionWizardReturn } from "../use-session-wizard";
import { CashResultFields } from "./cash-result-fields";
import { DateTimeFields } from "./date-time-fields";
import { TagsAndMemo } from "./tags-and-memo";

const NO_DISABLED_FIELDS: ReadonlySet<string> = new Set();

export function ResultStepBody({
	state,
	tags,
	onCreateTag,
	disabledFields = NO_DISABLED_FIELDS,
	endDateHint,
}: {
	/**
	 * Result fields to render read-only. A live-recorded session locks the
	 * values aggregated over several events while keeping the ones backed by a
	 * single event editable; everything else passes an empty set.
	 */
	disabledFields?: ReadonlySet<string>;
	/** Calendar day of the end time when the session crossed midnight. */
	endDateHint?: string | null;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	state: UseSessionWizardReturn;
	tags?: Array<{ id: string; name: string }>;
}) {
	return (
		<>
			<DateTimeFields
				disabledFields={disabledFields}
				endDateHint={endDateHint}
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
				/>
			)}
			<TagsAndMemo onCreateTag={onCreateTag} state={state} tags={tags} />
		</>
	);
}
