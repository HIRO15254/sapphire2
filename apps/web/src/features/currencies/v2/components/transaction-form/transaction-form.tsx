import {
	type TransactionFormValues,
	useTransactionForm,
} from "@/features/currencies/components/transaction-form/use-transaction-form";
import { useTypeCombobox } from "@/features/currencies/hooks/use-type-combobox";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/shared/components/ui/popover";
import { Textarea } from "@/shared/components/ui/textarea";

interface TransactionFormV2Props {
	defaultValues?: TransactionFormValues;
	formId: string;
	onSubmit: (values: TransactionFormValues) => void;
}

interface TypeComboboxProps {
	"aria-invalid"?: boolean;
	id?: string;
	newTypeName: string;
	onNewTypeNameChange: (name: string) => void;
	onTypeChange: (id: string) => void;
	typeId: string;
	types: { id: string; name: string }[];
}

function TypeCombobox({
	"aria-invalid": ariaInvalid,
	id,
	newTypeName,
	onNewTypeNameChange,
	onTypeChange,
	typeId,
	types,
}: TypeComboboxProps) {
	const {
		anchorRef,
		canCreate,
		contentWidth,
		filteredTypes,
		handleCreate,
		handleInputBlur,
		handleInputChange,
		handleInputFocus,
		handleKeyDown,
		handleSelect,
		inputValue,
		shouldShowPopover,
	} = useTypeCombobox({
		newTypeName,
		onNewTypeNameChange,
		onTypeChange,
		typeId,
		types,
	});

	return (
		<Popover
			modal={false}
			onOpenChange={() => undefined}
			open={shouldShowPopover}
		>
			<PopoverAnchor asChild>
				<div ref={anchorRef}>
					<Input
						aria-expanded={shouldShowPopover}
						aria-invalid={ariaInvalid}
						autoComplete="off"
						id={id}
						onBlur={(e) => {
							const relatedTarget = e.relatedTarget as HTMLElement | null;
							handleInputBlur(relatedTarget);
						}}
						onChange={(e) => {
							handleInputChange(e.target.value);
						}}
						onFocus={handleInputFocus}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
							}
							handleKeyDown(e.key);
						}}
						role="combobox"
						value={inputValue}
					/>
				</div>
			</PopoverAnchor>
			{shouldShowPopover ? (
				<PopoverContent
					align="start"
					className="p-0"
					onFocusOutside={(e) => e.preventDefault()}
					onOpenAutoFocus={(e) => e.preventDefault()}
					style={contentWidth ? { width: contentWidth } : undefined}
				>
					<Command shouldFilter={false}>
						<CommandList>
							{filteredTypes.length === 0 && !canCreate ? (
								<CommandEmpty>No matching types.</CommandEmpty>
							) : null}
							{filteredTypes.map((t) => (
								<CommandItem
									key={t.id}
									onMouseDown={(e) => e.preventDefault()}
									onSelect={() => handleSelect(t)}
									value={t.name}
								>
									{t.name}
								</CommandItem>
							))}
							{canCreate ? (
								<CommandItem
									onMouseDown={(e) => e.preventDefault()}
									onSelect={handleCreate}
									value={`create-${inputValue.trim()}`}
								>
									Create &quot;{inputValue.trim()}&quot;
								</CommandItem>
							) : null}
						</CommandList>
					</Command>
				</PopoverContent>
			) : null}
		</Popover>
	);
}

export function TransactionFormV2({
	defaultValues,
	formId,
	onSubmit,
}: TransactionFormV2Props) {
	const { form, types } = useTransactionForm({ defaultValues, onSubmit });

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
