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
	/**
	 * Stable id assigned to the `<form>` element so the surrounding
	 * `FormSheet` toolbar's Save button can submit it via the HTML `form`
	 * attribute. The form renders no submit button of its own — see
	 * `.claude/rules/web-theme.md`.
	 */
	formId: string;
	/** Field label override. Defaults to "Tag name" when omitted. */
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
