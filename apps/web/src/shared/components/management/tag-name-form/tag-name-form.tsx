import type * as React from "react";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { useTagNameForm } from "./use-tag-name-form";

export function TagNameForm({
	children,
	defaultName,
	formId,
	label,
	onSubmit,
}: {
	children?: React.ReactNode;
	defaultName?: string;
	formId: string;
	label?: string;
	onSubmit: (name: string) => void;
}) {
	const { form, label: resolvedLabel } = useTagNameForm({
		defaultName,
		label,
		onSubmit,
	});

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
			<form.Field name="name">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label={resolvedLabel}
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			{children}
		</form>
	);
}
