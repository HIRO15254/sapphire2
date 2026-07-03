import { RoomGameSelectors } from "@/features/sessions/components/session-wizard/master-step-body/link-selectors";
import { ResultStepBody } from "@/features/sessions/components/session-wizard/result-step-body";
import { TagsAndMemo } from "@/features/sessions/components/session-wizard/result-step-body/tags-and-memo";
import { RulesStepBody } from "@/features/sessions/components/session-wizard/rules-step-body";
import type {
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import { Field } from "@/shared/components/ui/field";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import {
	type UseSessionEditFormReturn,
	useSessionEditForm,
} from "./use-session-edit-form";

interface SessionEditFormProps {
	currencies?: Array<{ id: string; name: string }>;
	defaultValues?: SessionFormDefaults;
	/** Stable id linking the sheet's confirm button to this form. */
	formId: string;
	/**
	 * `true` when the session was recorded live. Live sessions derive every
	 * result / rule / time field from their event history, so the edit sheet
	 * only exposes the metadata `session.update` accepts for them (room,
	 * currency, tags, memo).
	 */
	isLiveLinked?: boolean;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	rooms?: Array<{ id: string; name: string }>;
	tags?: Array<{ id: string; name: string }>;
	tournaments?: TournamentOption[];
}

function LiveLinkedFields({
	state,
	rooms,
	currencies,
	tags,
	onCreateTag,
}: {
	state: UseSessionEditFormReturn["state"];
	rooms?: Array<{ id: string; name: string }>;
	currencies?: Array<{ id: string; name: string }>;
	tags?: Array<{ id: string; name: string }>;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
}) {
	return (
		<>
			{rooms && rooms.length > 0 && (
				<Field label="Room">
					<SelectWithClear
						onValueChange={state.handleRoomChange}
						value={state.selectedRoomId}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{rooms.map((room) => (
								<SelectItem key={room.id} value={room.id}>
									{room.name}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				</Field>
			)}
			{currencies && currencies.length > 0 && (
				<Field label="Currency">
					<SelectWithClear
						onValueChange={state.setSelectedCurrencyId}
						value={state.selectedCurrencyId}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{currencies.map((currency) => (
								<SelectItem key={currency.id} value={currency.id}>
									{currency.name}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				</Field>
			)}
			<TagsAndMemo onCreateTag={onCreateTag} state={state} tags={tags} />
		</>
	);
}

/**
 * Single-screen post-edit form for a completed session, rendered inside the
 * shared `FormSheet` (its `[✓]` button submits this form via `form={formId}`).
 * Replaces the reused create wizard for the edit flow: manual sessions expose
 * every editable field on one scroll (no stepper, no master pre-fill walk),
 * live-recorded sessions expose only the metadata their `session.update`
 * accepts.
 */
export function SessionEditForm({
	currencies,
	defaultValues,
	formId,
	isLiveLinked = false,
	onCreateTag,
	onRoomChange,
	onSubmit,
	ringGames,
	rooms,
	tags,
	tournaments,
}: SessionEditFormProps) {
	const { state } = useSessionEditForm({
		defaultValues,
		onRoomChange,
		onSubmit,
		ringGames,
		tournaments,
	});

	return (
		<form
			className="flex flex-col gap-3"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				state.form.handleSubmit();
			}}
		>
			{isLiveLinked ? (
				<LiveLinkedFields
					currencies={currencies}
					onCreateTag={onCreateTag}
					rooms={rooms}
					state={state}
					tags={tags}
				/>
			) : (
				<>
					<RoomGameSelectors
						gameLabel={state.gameLabel}
						gameOptions={state.gameOptions}
						onGameChange={state.handleGameChange}
						onRoomChange={state.handleRoomChange}
						rooms={rooms}
						selectedGameId={state.selectedGameId}
						selectedRoomId={state.selectedRoomId}
					/>
					<RulesStepBody
						currencies={currencies}
						isLiveLinked={false}
						showOverrides={false}
						state={state}
					/>
					<ResultStepBody
						isLiveLinked={false}
						onCreateTag={onCreateTag}
						state={state}
						tags={tags}
					/>
				</>
			)}
		</form>
	);
}
