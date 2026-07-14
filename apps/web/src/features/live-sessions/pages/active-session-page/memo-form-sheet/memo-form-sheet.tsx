import { MemoFields } from "@/features/live-sessions/components/event-fields/memo-fields";
import { FormSheet } from "@/shared/components/form-sheet";
import { useMemoFormSheet } from "./use-memo-form-sheet";

const MEMO_FORM_ID = "active-session-memo-form";

interface MemoFormSheetProps {
	onOpenChange: (open: boolean) => void;
	onSubmit: (text: string) => void;
	open: boolean;
}

/**
 * Standalone memo entry sheet for the "+" event menu — records a session
 * `memo` event without going through the stack form.
 */
export function MemoFormSheet({
	onOpenChange,
	onSubmit,
	open,
}: MemoFormSheetProps) {
	const { form } = useMemoFormSheet({ onSubmit });

	return (
		<FormSheet
			formId={MEMO_FORM_ID}
			onOpenChange={onOpenChange}
			open={open}
			title="Add Memo"
		>
			<form
				className="flex flex-col gap-4"
				id={MEMO_FORM_ID}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="text">
					{(field) => (
						<MemoFields
							error={field.state.meta.errors[0]?.message}
							onTextChange={(v) => field.handleChange(v)}
							text={field.state.value}
						/>
					)}
				</form.Field>
			</form>
		</FormSheet>
	);
}
