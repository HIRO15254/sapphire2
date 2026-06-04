import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { TypeCombobox } from "./type-combobox";
import {
	type TransactionFormValues,
	useTransactionForm,
} from "./use-transaction-form";

interface TransactionFormV2Props {
	defaultValues?: TransactionFormValues;
	formId: string;
	onSubmit: (values: TransactionFormValues) => void;
}

export function TransactionFormV2({
	defaultValues,
	formId,
	onSubmit,
}: TransactionFormV2Props) {
	const { form, types, reservedTypeNames } = useTransactionForm({
		defaultValues,
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
			<form.Field name="transactionTypeId">
				{(typeField) => (
					<form.Field name="newTypeName">
						{(newTypeField) => (
							<Field
								error={typeField.state.meta.errors[0]?.message}
								htmlFor={typeField.name}
								label="Type"
								required
							>
								<TypeCombobox
									id={typeField.name}
									newTypeName={newTypeField.state.value}
									onNewTypeNameChange={newTypeField.handleChange}
									onTypeChange={typeField.handleChange}
									reservedNames={reservedTypeNames}
									typeId={typeField.state.value}
									types={types}
								/>
							</Field>
						)}
					</form.Field>
				)}
			</form.Field>
			<form.Field name="amount">
				{(field) => (
					<Field
						description="Use a negative value for a withdrawal."
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Amount"
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
			<form.Field name="transactedAt">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Date"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							type="date"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</form>
	);
}
