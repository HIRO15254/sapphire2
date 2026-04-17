import { useForm } from "@tanstack/react-form";
import type * as React from "react";
import z from "zod";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

const tagNameFormSchema = z.object({
	name: z
		.string()
		.min(1, "Tag name is required")
		.max(50, "Tag name must be 50 characters or less"),
});

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
	const form = useForm({
		defaultValues: {
			name: defaultName ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit(value.name);
		},
		validators: {
			onSubmit: tagNameFormSchema,
		},
	});

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
							maxLength={50}
							minLength={1}
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
			<form.Subscribe>
				{(state) => (
					<Button
						disabled={isLoading || !state.canSubmit || state.isSubmitting}
						type="submit"
					>
						{isLoading || state.isSubmitting ? "Saving..." : "Save"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
