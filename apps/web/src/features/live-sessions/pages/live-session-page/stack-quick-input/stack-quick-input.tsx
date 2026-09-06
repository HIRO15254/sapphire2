import { IconPencilCheck, IconStack2 } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
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
								className="h-[var(--m-control)] w-full rounded-md border border-input bg-transparent pr-2.5 pl-8 font-mono text-[length:var(--m-text-secondary)] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
			<Button
				aria-label="Save stack"
				className="size-10 shrink-0"
				disabled={isDisabled || isPending}
				form={FORM_ID}
				size="icon"
				type="submit"
			>
				<IconPencilCheck size={18} />
			</Button>
		</form>
	);
}
