import { IconPencilCheck, IconStack2, IconUsers } from "@tabler/icons-react";
import { Field } from "@/shared/components/ui/field";
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

const COUNT_INPUT_CLASS =
	"border-none bg-transparent font-mono text-[length:var(--m-text-secondary)] tabular-nums outline-none disabled:opacity-50";

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
							className="pointer-events-none absolute top-5 left-2.5 -translate-y-1/2 text-muted-foreground"
							size={15}
						/>
						<Field error={field.state.meta.errors[0]?.message}>
							<input
								aria-label="Current stack"
								className="h-[var(--m-control)] w-full rounded-md border border-input bg-background pr-2.5 pl-[31px] font-mono text-[length:var(--m-text-secondary)] tabular-nums outline-none focus-visible:border-primary disabled:opacity-50 aria-invalid:border-destructive aria-invalid:bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)]"
								disabled={isDisabled}
								id={field.name}
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
							const error =
								playersField.state.meta.errors[0]?.message ??
								entriesField.state.meta.errors[0]?.message;
							return (
								<Field error={error}>
									<div className="flex h-[var(--m-control)] items-center gap-0.5 rounded-md border border-input bg-background px-2">
										<IconUsers
											className="mr-1 shrink-0 text-muted-foreground"
											size={15}
										/>
										<input
											aria-invalid={
												playersField.state.meta.errors.length > 0 || undefined
											}
											aria-label="Players left"
											className={`${COUNT_INPUT_CLASS} w-[34px] text-right`}
											disabled={isDisabled}
											id={playersField.name}
											inputMode="numeric"
											name={playersField.name}
											onBlur={playersField.handleBlur}
											onChange={(e) =>
												playersField.handleChange(e.target.value)
											}
											type="text"
											value={playersField.state.value}
										/>
										<span className="font-mono text-[length:var(--m-text-secondary)] text-muted-foreground">
											/
										</span>
										<input
											aria-invalid={
												entriesField.state.meta.errors.length > 0 || undefined
											}
											aria-label="Total entries"
											className={`${COUNT_INPUT_CLASS} w-[38px] text-muted-foreground`}
											disabled={isDisabled}
											id={entriesField.name}
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
								</Field>
							);
						}}
					</form.Field>
				)}
			</form.Field>
			<button
				aria-label="Save stack"
				className="inline-flex size-[var(--m-control)] shrink-0 items-center justify-center rounded-md border border-transparent bg-primary text-primary-foreground disabled:opacity-50"
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
