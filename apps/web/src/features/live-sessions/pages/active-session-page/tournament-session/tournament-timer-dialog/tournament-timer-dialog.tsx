import { BottomSheet } from "@/shared/components/bottom-sheet";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { useTournamentTimerDialog } from "./use-tournament-timer-dialog";

const TIMER_FORM_ID = "tournament-timer-form";

interface TournamentTimerDialogProps {
	isLoading?: boolean;
	onClear?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (timerStartedAt: Date) => void;
	open: boolean;
	timerStartedAt: Date | string | number | null;
}

export function TournamentTimerDialog({
	isLoading = false,
	onClear,
	onOpenChange,
	onSubmit,
	open,
	timerStartedAt,
}: TournamentTimerDialogProps) {
	const { form } = useTournamentTimerDialog({ open, timerStartedAt, onSubmit });

	return (
		<BottomSheet
			cancelLabel="Cancel"
			confirmLabel="Save"
			formId={TIMER_FORM_ID}
			isConfirmPending={isLoading}
			onOpenChange={onOpenChange}
			open={open}
			title={timerStartedAt ? "Edit Timer Start" : "Start Tournament Timer"}
		>
			<form
				className="flex flex-col gap-4"
				id={TIMER_FORM_ID}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="timerStartedAt">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Timer start time"
							required
						>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								step={60}
								type="datetime-local"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				{timerStartedAt && onClear ? (
					<Button
						disabled={isLoading}
						onClick={onClear}
						type="button"
						variant="outline"
					>
						Clear
					</Button>
				) : null}
			</form>
		</BottomSheet>
	);
}
