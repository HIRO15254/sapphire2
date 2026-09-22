import { IconPencilCheck, IconStack2, IconUsers } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Field, FieldError } from "@/shared/components/ui/field";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { CRYST_FIELD, CRYST_FIELD_GROUP, crystButton } from "../cryst-controls";
import {
	type TournamentStackValues,
	useTournamentQuickInput,
} from "./use-tournament-quick-input";

interface TournamentQuickInputProps {
	currentStack: number | null;
	isDisabled: boolean;
	isPending: boolean;
	onSubmit: (values: TournamentStackValues) => void;
	remainingPlayers: number | null;
	totalEntries: number | null;
}

const FORM_ID = "cryst-tournament-quick-input";
const PLAYERS_ERROR_ID = "cryst-tournament-players-error";
const ENTRIES_ERROR_ID = "cryst-tournament-entries-error";

const COUNT_INPUT_CLASS =
	"border-none bg-transparent font-mono tabular-nums outline-none disabled:opacity-50";

export function TournamentQuickInput({
	currentStack,
	isDisabled,
	isPending,
	onSubmit,
	remainingPlayers,
	totalEntries,
}: TournamentQuickInputProps) {
	const { form } = useTournamentQuickInput({
		currentStack,
		isSaving: isPending,
		onSubmit,
		remainingPlayers,
		totalEntries,
	});

	return (
		<form
			className="grid grid-cols-[1fr_auto_auto] items-start gap-1.5"
			id={FORM_ID}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="stackAmount">
				{(field) => (
					<div className="relative min-w-0">
						<IconStack2
							className="pointer-events-none absolute top-5 left-[9px] -translate-y-1/2 text-muted-foreground"
							size={16}
						/>
						<Field error={field.state.meta.errors[0]?.message}>
							<input
								aria-label="Current stack"
								className={cn(
									CRYST_FIELD,
									"h-[var(--m-control)] w-full pr-2.5 pl-[31px] font-mono tabular-nums"
								)}
								disabled={isDisabled}
								id={field.name}
								{...NO_INPUT_SUGGESTIONS}
								inputMode="numeric"
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="text"
								value={field.state.value}
							/>
						</Field>
					</div>
				)}
			</form.Field>
			<form.Field name="remainingPlayers">
				{(playersField) => (
					<form.Field name="totalEntries">
						{(entriesField) => {
							const playersError = playersField.state.meta.errors[0]?.message;
							const entriesError = entriesField.state.meta.errors[0]?.message;
							return (
								<div className="flex flex-col gap-2">
									<div
										className={cn(
											CRYST_FIELD_GROUP,
											"flex h-[var(--m-control)] items-center gap-0.5 px-2",
											(playersError || entriesError) && "border-destructive"
										)}
									>
										<IconUsers
											className="mr-1 shrink-0 text-muted-foreground"
											size={16}
										/>
										<input
											aria-describedby={
												playersError ? PLAYERS_ERROR_ID : undefined
											}
											aria-invalid={playersError ? true : undefined}
											aria-label="Players left"
											className={`${COUNT_INPUT_CLASS} w-[34px] text-right`}
											disabled={isDisabled}
											id={playersField.name}
											{...NO_INPUT_SUGGESTIONS}
											inputMode="numeric"
											name={playersField.name}
											onBlur={playersField.handleBlur}
											onChange={(e) =>
												playersField.handleChange(e.target.value)
											}
											type="text"
											value={playersField.state.value}
										/>
										<span className="font-mono text-muted-foreground">/</span>
										<input
											aria-describedby={
												entriesError ? ENTRIES_ERROR_ID : undefined
											}
											aria-invalid={entriesError ? true : undefined}
											aria-label="Total entries"
											className={`${COUNT_INPUT_CLASS} w-[38px] text-muted-foreground`}
											disabled={isDisabled}
											id={entriesField.name}
											{...NO_INPUT_SUGGESTIONS}
											inputMode="numeric"
											name={entriesField.name}
											onBlur={entriesField.handleBlur}
											onChange={(e) =>
												entriesField.handleChange(e.target.value)
											}
											type="text"
											value={entriesField.state.value}
										/>
									</div>
									{playersError ? (
										<FieldError id={PLAYERS_ERROR_ID}>
											Players left: {playersError}
										</FieldError>
									) : null}
									{entriesError ? (
										<FieldError id={ENTRIES_ERROR_ID}>
											Total entries: {entriesError}
										</FieldError>
									) : null}
								</div>
							);
						}}
					</form.Field>
				)}
			</form.Field>
			<button
				aria-label="Save stack"
				className={crystButton({ size: "icon", variant: "primary" })}
				disabled={isDisabled || isPending}
				form={FORM_ID}
				title="Save stack"
				type="submit"
			>
				<IconPencilCheck size={18} />
			</button>
		</form>
	);
}
