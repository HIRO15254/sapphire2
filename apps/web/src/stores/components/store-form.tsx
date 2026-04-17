import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";

interface StoreFormValues {
	memo?: string;
	name: string;
}

interface StoreFormProps {
	defaultValues?: StoreFormValues;
	isLoading?: boolean;
	onSubmit: (values: StoreFormValues) => void;
}

const storeFormSchema = z.object({
	name: z
		.string()
		.min(1, "Store name is required")
		.max(100, "Store name must be 100 characters or less"),
	memo: z
		.string()
		.max(10_000, "Memo must be 10,000 characters or less")
		.optional(),
});

export function StoreForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: StoreFormProps) {
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			memo: defaultValues?.memo ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				memo: value.memo || undefined,
			});
		},
		validators: {
			onSubmit: storeFormSchema,
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
						label="Store Name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Enter store name"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="memo">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Memo"
					>
						<Textarea
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Optional notes about this store"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
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
