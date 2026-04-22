import { useTournamentTimerDialog } from "@/live-sessions/hooks/use-tournament-timer-dialog";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

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
		<ResponsiveDialog
			description="Set the time when the tournament blind timer began. Leave in the past to reflect a late-start entry."
			onOpenChange={onOpenChange}
			open={open}
			title={timerStartedAt ? "Edit Timer Start" : "Start Tournament Timer"}
		>
			<form
				className="flex flex-col gap-4"
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

				<DialogActionRow>
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
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
					>
						{([canSubmit, isSubmitting]) => (
							<Button
								disabled={!canSubmit || isSubmitting || isLoading}
								type="submit"
							>
								{isLoading ? "Saving..." : "Save"}
							</Button>
						)}
					</form.Subscribe>
				</DialogActionRow>
			</form>
		</ResponsiveDialog>
	);
}
