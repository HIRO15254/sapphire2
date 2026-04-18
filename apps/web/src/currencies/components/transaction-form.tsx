import { useForm } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useTransactionTypes } from "@/currencies/hooks/use-transaction-types";
import { Button } from "@/shared/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/shared/components/ui/popover";
import { Textarea } from "@/shared/components/ui/textarea";
import { requiredNumericString } from "@/shared/lib/form-fields";

const NEW_TYPE_VALUE = "__new__";

interface TransactionFormValues {
	amount: number;
	memo?: string;
	transactedAt: string;
	transactionTypeId: string;
}

interface TransactionFormProps {
	defaultValues?: TransactionFormValues;
	isLoading?: boolean;
	onSubmit: (values: TransactionFormValues) => void;
}

interface TypeComboboxProps {
	id?: string;
	newTypeName: string;
	onNewTypeNameChange: (name: string) => void;
	onTypeChange: (id: string) => void;
	typeId: string;
	types: { id: string; name: string }[];
}

function TypeCombobox({
	id,
	newTypeName,
	onNewTypeNameChange,
	onTypeChange,
	typeId,
	types,
}: TypeComboboxProps) {
	const initialDisplay =
		typeId === NEW_TYPE_VALUE
			? newTypeName
			: (types.find((t) => t.id === typeId)?.name ?? "");

	const [inputValue, setInputValue] = useState(initialDisplay);
	const [isFiltering, setIsFiltering] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [contentWidth, setContentWidth] = useState<number>();
	const anchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!typeId || typeId === NEW_TYPE_VALUE) {
			return;
		}
		const typeName = types.find((t) => t.id === typeId)?.name;
		if (typeName) {
			setInputValue(typeName);
			setIsFiltering(false);
		}
	}, [typeId, types]);

	const normalizedInput = inputValue.trim();
	const filteredTypes = types.filter(
		(t) =>
			!(isFiltering && normalizedInput) ||
			t.name.toLowerCase().includes(normalizedInput.toLowerCase())
	);
	const exactMatch = types.find(
		(t) => t.name.toLowerCase() === normalizedInput.toLowerCase()
	);
	const canCreate = Boolean(normalizedInput && !exactMatch);
	const shouldShowPopover =
		isOpen && (types.length > 0 || Boolean(normalizedInput));

	useEffect(() => {
		if (!(shouldShowPopover && anchorRef.current)) {
			return;
		}
		setContentWidth(anchorRef.current.offsetWidth);
	}, [shouldShowPopover]);

	const handleSelect = (type: { id: string; name: string }) => {
		setInputValue(type.name);
		setIsFiltering(false);
		onTypeChange(type.id);
		onNewTypeNameChange("");
		setIsOpen(false);
	};

	const handleCreate = () => {
		setIsFiltering(false);
		onTypeChange(NEW_TYPE_VALUE);
		onNewTypeNameChange(normalizedInput);
		setIsOpen(false);
	};

	return (
		<Popover modal={false} onOpenChange={setIsOpen} open={shouldShowPopover}>
			<PopoverAnchor asChild>
				<div ref={anchorRef}>
					<Input
						aria-expanded={shouldShowPopover}
						autoComplete="off"
						id={id}
						onChange={(e) => {
							setInputValue(e.target.value);
							setIsFiltering(true);
							setIsOpen(true);
							onTypeChange("");
							onNewTypeNameChange("");
						}}
						onFocus={() => setIsOpen(true)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								if (exactMatch) {
									handleSelect(exactMatch);
								} else if (canCreate) {
									handleCreate();
								}
							}
							if (e.key === "Escape") {
								setIsOpen(false);
							}
						}}
						placeholder="Select or create type..."
						role="combobox"
						value={inputValue}
					/>
				</div>
			</PopoverAnchor>
			{shouldShowPopover ? (
				<PopoverContent
					align="start"
					className="p-0"
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
									value={`create-${normalizedInput}`}
								>
									Create &quot;{normalizedInput}&quot;
								</CommandItem>
							) : null}
						</CommandList>
					</Command>
				</PopoverContent>
			) : null}
		</Popover>
	);
}

function todayISODate() {
	return new Date().toISOString().slice(0, 10);
}

function getButtonLabel(isCreatingType: boolean, isLoading: boolean) {
	if (isCreatingType) {
		return "Creating type...";
	}
	if (isLoading) {
		return "Saving...";
	}
	return "Save";
}

function buildSchema() {
	return z
		.object({
			amount: requiredNumericString(),
			transactionTypeId: z.string().min(1, "Type is required"),
			newTypeName: z.string(),
			transactedAt: z.string().min(1, "Date is required"),
			memo: z.string(),
		})
		.superRefine((value, ctx) => {
			if (
				value.transactionTypeId === NEW_TYPE_VALUE &&
				value.newTypeName.trim() === ""
			) {
				ctx.addIssue({
					code: "custom",
					path: ["newTypeName"],
					message: "New type name is required",
				});
			}
		});
}

export function TransactionForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: TransactionFormProps) {
	const { types, createType, isCreatingType } = useTransactionTypes();

	const form = useForm({
		defaultValues: {
			amount:
				defaultValues?.amount === undefined ? "" : String(defaultValues.amount),
			transactionTypeId: defaultValues?.transactionTypeId ?? "",
			newTypeName: "",
			transactedAt: defaultValues?.transactedAt
				? new Date(defaultValues.transactedAt).toISOString().slice(0, 10)
				: todayISODate(),
			memo: defaultValues?.memo ?? "",
		},
		onSubmit: async ({ value }) => {
			let transactionTypeId = value.transactionTypeId;
			if (transactionTypeId === NEW_TYPE_VALUE) {
				const created = await createType(value.newTypeName.trim());
				transactionTypeId = created.id;
			}
			onSubmit({
				amount: Number(value.amount),
				transactionTypeId,
				transactedAt: value.transactedAt,
				memo: value.memo ? value.memo : undefined,
			});
		},
		validators: {
			onSubmit: buildSchema(),
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
							placeholder="Enter amount (negative for withdrawal)"
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
							placeholder="Optional note"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<DialogActionRow>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button
							disabled={
								isLoading || isCreatingType || !canSubmit || isSubmitting
							}
							type="submit"
						>
							{getButtonLabel(isCreatingType, isLoading)}
						</Button>
					)}
				</form.Subscribe>
			</DialogActionRow>
		</form>
	);
}
