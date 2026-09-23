import { IconClockOff } from "@tabler/icons-react";
import { useTournamentCompleteForm } from "@/features/live-sessions/components/tournament-complete-form";
import { Switch } from "@/shared/components/ui/switch";
import { CrystFormSheet } from "./cryst-form-sheet";
import {
	END_SHEET_FOOTER,
	EndNumericField,
	EndSheetNote,
} from "./end-sheet-fields";

const FORM_ID = "cryst-end-tournament-form";
const EARLY_EXIT_ID = "cryst-end-early-exit";

export type TournamentCompleteValues =
	| {
			beforeDeadline: false;
			bountyPrizes: number;
			placement: number;
			prizeMoney: number;
			totalEntries: number;
	  }
	| {
			beforeDeadline: true;
			bountyPrizes: number;
			prizeMoney: number;
	  };

interface EndTournamentSheetProps {
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: TournamentCompleteValues) => void;
	open: boolean;
}

function EndTournamentForm({
	onSubmit,
}: {
	onSubmit: (values: TournamentCompleteValues) => void;
}) {
	const { form } = useTournamentCompleteForm({ onSubmit });

	return (
		<form
			className="flex flex-col gap-3"
			id={FORM_ID}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="beforeDeadline">
				{(field) => (
					<div className="flex items-center justify-between gap-2.5 rounded-md border border-border px-3 py-2.5">
						<label
							className="inline-flex min-w-0 items-center gap-1.5 text-[length:var(--text-sm)]"
							htmlFor={EARLY_EXIT_ID}
						>
							<IconClockOff
								aria-hidden
								className="shrink-0 text-warning"
								size={16}
							/>
							Early exit (left before the result)
						</label>
						<Switch
							checked={field.state.value}
							className="h-6 w-10 shrink-0 shadow-none duration-[160ms] [&_[data-slot=switch-thumb]]:size-5 [&_[data-slot=switch-thumb]]:bg-white [&_[data-slot=switch-thumb]]:shadow-[var(--shadow-sm)] [&_[data-slot=switch-thumb]]:duration-[160ms]"
							id={EARLY_EXIT_ID}
							onCheckedChange={field.handleChange}
						/>
					</div>
				)}
			</form.Field>

			<form.Subscribe selector={(state) => state.values.beforeDeadline}>
				{(isEarlyExit) =>
					isEarlyExit ? (
						<EndSheetNote>
							Early exit does not record place or total entries.
						</EndSheetNote>
					) : (
						<>
							<div className="grid grid-cols-2 gap-2">
								<form.Field name="placement">
									{(field) => (
										<EndNumericField
											error={field.state.meta.errors[0]?.message}
											id="cryst-end-place"
											label="Place"
											name={field.name}
											onBlur={field.handleBlur}
											onChange={field.handleChange}
											required
											value={field.state.value}
										/>
									)}
								</form.Field>
								<form.Field name="totalEntries">
									{(field) => (
										<EndNumericField
											error={field.state.meta.errors[0]?.message}
											id="cryst-end-total-entries"
											label="Total entries"
											name={field.name}
											onBlur={field.handleBlur}
											onChange={field.handleChange}
											required
											value={field.state.value}
										/>
									)}
								</form.Field>
							</div>
							<EndSheetNote>Place must not exceed total entries.</EndSheetNote>
						</>
					)
				}
			</form.Subscribe>

			<div className="grid grid-cols-2 gap-2">
				<form.Field name="prizeMoney">
					{(field) => (
						<EndNumericField
							error={field.state.meta.errors[0]?.message}
							id="cryst-end-prize"
							label="Prize"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={field.handleChange}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="bountyPrizes">
					{(field) => (
						<EndNumericField
							error={field.state.meta.errors[0]?.message}
							id="cryst-end-bounty"
							label="Bounty won"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
			</div>

			<EndSheetNote>{END_SHEET_FOOTER}</EndSheetNote>
		</form>
	);
}

export function EndTournamentSheet({
	isPending,
	onOpenChange,
	onSubmit,
	open,
}: EndTournamentSheetProps) {
	return (
		<CrystFormSheet
			formId={FORM_ID}
			isLoading={isPending}
			onOpenChange={onOpenChange}
			open={open}
			title="End session"
		>
			<EndTournamentForm onSubmit={onSubmit} />
		</CrystFormSheet>
	);
}
