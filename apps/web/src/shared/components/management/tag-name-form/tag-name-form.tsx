import type * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { useTagNameForm } from "./use-tag-name-form";

export function TagNameForm({
	children,
	defaultName,
	isLoading,
	onSubmit,
}: {
	children?: React.ReactNode;
	defaultName?: string;
	isLoading?: boolean;
	onSubmit: (name: string) => void;
}) {
	const { form } = useTagNameForm({ defaultName, onSubmit });

	return (
		<form
			className="flex flex-col gap-4"
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
						label="Tag Name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Enter tag name"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			{children}
			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, isSubmitting]) => (
					<Button
						disabled={isLoading || !canSubmit || isSubmitting}
						type="submit"
					>
						{isLoading ? "Saving..." : "Save"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
