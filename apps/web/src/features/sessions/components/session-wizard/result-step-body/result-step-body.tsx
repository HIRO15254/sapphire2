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
	/**
	 * Result fields to render read-only. A live-recorded session locks the
	 * values aggregated over several events while keeping the ones backed by a
	 * single event editable; everything else passes an empty set.
	 */
	disabledFields?: ReadonlySet<string>;
	/** Calendar day the end time writes to, when it is not the displayed date. */
	endDateHint?: string | null;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	/**
	 * Fields to render with a required mark. A live session's event-backed
	 * result fields are required even though the shared schema keeps them
	 * optional for manual sessions.
	 */
	requiredFields?: ReadonlySet<string>;
	/** Same, for the start time. */
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
