import { IconPencilCheck, IconStack2 } from "@tabler/icons-react";
import { Field } from "@/shared/components/ui/field";
import { useStackQuickInput } from "./use-stack-quick-input";

interface StackQuickInputProps {
	currentStack: number | null;
	isDisabled: boolean;
	isPending: boolean;
	onSubmit: (values: { stackAmount: number }) => void;
}

const FORM_ID = "cryst-stack-quick-input";

export function StackQuickInput({
	currentStack,
	isDisabled,
	isPending,
	onSubmit,
}: StackQuickInputProps) {
	const { form } = useStackQuickInput({ currentStack, onSubmit });

	return (
		<form
			className="grid grid-cols-[1fr_auto] items-start gap-1.5"
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
