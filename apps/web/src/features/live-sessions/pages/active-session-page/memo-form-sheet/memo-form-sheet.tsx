import { MemoFields } from "@/features/live-sessions/components/event-fields/memo-fields";
import { BottomSheet } from "@/shared/components/bottom-sheet";
import { useMemoFormSheet } from "./use-memo-form-sheet";

const MEMO_FORM_ID = "active-session-memo-form";

interface MemoFormSheetProps {
	onOpenChange: (open: boolean) => void;
	onSubmit: (text: string) => void;
	open: boolean;
}

export function MemoFormSheet({
	onOpenChange,
	onSubmit,
	open,
}: MemoFormSheetProps) {
	const { form } = useMemoFormSheet({ onSubmit });

	return (
		<BottomSheet
			cancelLabel="Cancel"
			confirmLabel="Log"
			formId={MEMO_FORM_ID}
			onOpenChange={onOpenChange}
			open={open}
			title="Note"
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
		</BottomSheet>
	);
}
