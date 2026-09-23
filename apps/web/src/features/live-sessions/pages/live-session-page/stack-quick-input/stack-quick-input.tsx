import { IconPencilCheck, IconStack2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { CRYST_FIELD, crystButton } from "../cryst-controls";
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
	const { form } = useStackQuickInput({
		currentStack,
		isSaving: isPending,
		onSubmit,
	});

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
