import { AllInEditor } from "../all-in-editor";
import { ChipsAddRemoveEditor } from "../chips-add-remove-editor";
import { MemoEditor } from "../memo-editor";
import { PurchaseChipsEditor } from "../purchase-chips-editor";
import { SessionEndEditor } from "../session-end-editor";
import { SessionStartEditor } from "../session-start-editor";
import type { EditorBaseProps } from "../shared";
import { TimeOnlyEditor } from "../time-only-editor";
import { UpdateStackEditor } from "../update-stack-editor";

export function EventEditor(props: EditorBaseProps) {
	const { event } = props;

	switch (event.eventType) {
		case "session_start":
			return (
				<SessionStartEditor
					event={event}
					isLoading={props.isLoading}
					maxTime={props.maxTime}
					minTime={props.minTime}
					onSubmit={props.onSubmit}
					onTimeUpdate={props.onTimeUpdate}
					sessionType={props.sessionType}
				/>
			);
		case "session_end":
			return (
				<SessionEndEditor
					event={event}
					isLoading={props.isLoading}
					maxTime={props.maxTime}
					minTime={props.minTime}
					onSubmit={props.onSubmit}
					sessionType={props.sessionType}
				/>
			);
		case "session_pause":
		case "session_resume":
		case "player_join":
		case "player_leave":
			return (
				<TimeOnlyEditor
					event={event}
					isLoading={props.isLoading}
					maxTime={props.maxTime}
					minTime={props.minTime}
					onTimeUpdate={props.onTimeUpdate}
				/>
			);
		case "chips_add_remove":
			return (
				<ChipsAddRemoveEditor
					event={event}
					isLoading={props.isLoading}
					maxTime={props.maxTime}
					minTime={props.minTime}
					onSubmit={props.onSubmit}
				/>
			);
		case "update_stack":
			return (
				<UpdateStackEditor
					event={event}
					isLoading={props.isLoading}
					maxTime={props.maxTime}
					minTime={props.minTime}
					onSubmit={props.onSubmit}
					sessionType={props.sessionType}
				/>
			);
		case "all_in":
			return (
				<AllInEditor
					event={event}
					isLoading={props.isLoading}
					maxTime={props.maxTime}
					minTime={props.minTime}
					onSubmit={props.onSubmit}
				/>
			);
		case "purchase_chips":
			return (
				<PurchaseChipsEditor
					event={event}
					isLoading={props.isLoading}
					maxTime={props.maxTime}
					minTime={props.minTime}
					onSubmit={props.onSubmit}
				/>
			);
		case "memo":
			return (
				<MemoEditor
					event={event}
					isLoading={props.isLoading}
					maxTime={props.maxTime}
					minTime={props.minTime}
					onSubmit={props.onSubmit}
				/>
			);
		default:
			return (
				<TimeOnlyEditor
					event={event}
					isLoading={props.isLoading}
					maxTime={props.maxTime}
					minTime={props.minTime}
					onTimeUpdate={props.onTimeUpdate}
				/>
			);
	}
}
