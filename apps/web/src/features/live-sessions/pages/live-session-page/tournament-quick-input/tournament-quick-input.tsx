import type { Icon } from "@tabler/icons-react";
import {
	IconPencilCheck,
	IconStack2,
	IconUserPlus,
	IconUsers,
} from "@tabler/icons-react";
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

const INPUT_CLASS =
	"h-[var(--m-control)] w-full rounded-md border border-input bg-background pr-2.5 pl-[31px] font-mono text-[length:var(--m-text-secondary)] tabular-nums outline-none focus-visible:border-primary disabled:opacity-50 aria-invalid:border-destructive aria-invalid:bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)]";

function LeadingIcon({ icon: LeadIcon }: { icon: Icon }) {
	return (
		<LeadIcon
			className="pointer-events-none absolute top-5 left-2.5 -translate-y-1/2 text-muted-foreground"
			size={15}
		/>
	);
}

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
			className="flex flex-col gap-1.5"
			id={FORM_ID}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="grid grid-cols-[1fr_auto] items-start gap-1.5">
				<form.Field name="stackAmount">
					{(field) => (
						<div className="relative min-w-0">
							<LeadingIcon icon={IconStack2} />
							<Field error={field.state.meta.errors[0]?.message}>
								<input
									aria-label="Current stack"
									className={INPUT_CLASS}
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
			</div>
			<div className="grid grid-cols-2 gap-1.5">
				<form.Field name="remainingPlayers">
					{(field) => (
						<div className="relative min-w-0">
							<LeadingIcon icon={IconUsers} />
							<Field error={field.state.meta.errors[0]?.message}>
								<input
									aria-label="Players left"
									className={INPUT_CLASS}
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
				<form.Field name="totalEntries">
					{(field) => (
						<div className="relative min-w-0">
							<LeadingIcon icon={IconUserPlus} />
							<Field error={field.state.meta.errors[0]?.message}>
								<input
									aria-label="Total entries"
									className={INPUT_CLASS}
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
			</div>
		</form>
	);
}
