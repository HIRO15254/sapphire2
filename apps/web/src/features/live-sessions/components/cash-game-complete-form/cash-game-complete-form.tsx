import type { ReactNode } from "react";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { parseOptionalInt } from "@/shared/lib/form-fields";
import { useCashGameCompleteForm } from "./use-cash-game-complete-form";

interface CashGameCompleteFormProps {
	defaultFinalStack?: number;
	formId: string;
	onSubmit: (values: { finalStack: number }) => void;
	renderSummary?: (finalStack: number | undefined) => ReactNode;
}

export function CashGameCompleteForm({
	defaultFinalStack,
	formId,
	onSubmit,
	renderSummary,
}: CashGameCompleteFormProps) {
	const { form } = useCashGameCompleteForm({ defaultFinalStack, onSubmit });

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="finalStack">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Final Stack"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			{renderSummary ? (
				<form.Subscribe selector={(state) => state.values.finalStack}>
					{(value) => renderSummary(parseOptionalInt(value))}
				</form.Subscribe>
			) : null}
		</form>
	);
}
