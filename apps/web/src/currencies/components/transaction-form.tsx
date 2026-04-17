import { useRef, useState } from "react";
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

export function TransactionForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: TransactionFormProps) {
	const { types, createType, isCreatingType } = useTransactionTypes();

	const defaultType = defaultValues?.transactionTypeId
		? (types.find((t) => t.id === defaultValues.transactionTypeId)?.name ?? "")
		: "";

	const [typeInput, setTypeInput] = useState(defaultType);
	const [selectedTypeId, setSelectedTypeId] = useState(
		defaultValues?.transactionTypeId ?? ""
	);
	const [isTypeOpen, setIsTypeOpen] = useState(false);
	const typeAnchorRef = useRef<HTMLDivElement>(null);

	const normalizedInput = typeInput.trim();
	const filteredTypes = types.filter(
		(t) =>
			!normalizedInput ||
			t.name.toLowerCase().includes(normalizedInput.toLowerCase())
	);
	const matchingType = types.find(
		(t) => t.name.toLowerCase() === normalizedInput.toLowerCase()
	);
	const canCreate = Boolean(normalizedInput && !matchingType);
	const shouldRenderPopover =
		isTypeOpen && (types.length > 0 || Boolean(normalizedInput));

	const handleTypeSelect = (type: { id: string; name: string }) => {
		setTypeInput(type.name);
		setSelectedTypeId(type.id);
		setIsTypeOpen(false);
	};

	const handleTypeCreate = async () => {
		if (!normalizedInput) {
			return;
		}
		const created = await createType(normalizedInput);
		handleTypeSelect(created);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!selectedTypeId) {
			return;
		}
		const formData = new FormData(e.currentTarget);
		const amount = Number(formData.get("amount"));
		const transactedAt = formData.get("transactedAt") as string;
		const memo = (formData.get("memo") as string) || undefined;

		onSubmit({ amount, transactionTypeId: selectedTypeId, transactedAt, memo });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="amount" label="Amount" required>
				<Input
					defaultValue={defaultValues?.amount}
					id="amount"
					name="amount"
					placeholder="Enter amount (negative for withdrawal)"
					required
					type="number"
				/>
			</Field>
			<Field label="Type" required>
				<Popover
					modal={false}
					onOpenChange={setIsTypeOpen}
					open={shouldRenderPopover}
				>
					<PopoverAnchor asChild>
						<div ref={typeAnchorRef}>
							<Input
								aria-label="Type"
								autoComplete="off"
								onChange={(e) => {
									setTypeInput(e.target.value);
									setSelectedTypeId("");
									setIsTypeOpen(true);
								}}
								onFocus={() => setIsTypeOpen(true)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										if (matchingType) {
											handleTypeSelect(matchingType);
										} else if (canCreate) {
											handleTypeCreate().catch(() => undefined);
										}
									}
									if (e.key === "Escape") {
										setIsTypeOpen(false);
									}
								}}
								placeholder="Select or create type..."
								role="combobox"
								value={typeInput}
							/>
						</div>
					</PopoverAnchor>
					{shouldRenderPopover ? (
						<PopoverContent
							align="start"
							className="p-0"
							onOpenAutoFocus={(e) => e.preventDefault()}
							style={
								typeAnchorRef.current
									? { width: typeAnchorRef.current.offsetWidth }
									: undefined
							}
						>
							<Command shouldFilter={false}>
								<CommandList>
									{filteredTypes.length === 0 && !canCreate ? (
										<CommandEmpty>No types found.</CommandEmpty>
									) : null}
									{filteredTypes.map((t) => (
										<CommandItem
											key={t.id}
											onMouseDown={(e) => e.preventDefault()}
											onSelect={() => handleTypeSelect(t)}
											value={t.name}
										>
											{t.name}
										</CommandItem>
									))}
									{canCreate ? (
										<CommandItem
											onMouseDown={(e) => e.preventDefault()}
											onSelect={() => {
												handleTypeCreate().catch(() => undefined);
											}}
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
			</Field>
			<Field htmlFor="transactedAt" label="Date" required>
				<Input
					defaultValue={
						defaultValues?.transactedAt
							? new Date(defaultValues.transactedAt).toISOString().slice(0, 10)
							: todayISODate()
					}
					id="transactedAt"
					name="transactedAt"
					required
					type="date"
				/>
			</Field>
			<Field htmlFor="memo" label="Memo">
				<Textarea
					defaultValue={defaultValues?.memo}
					id="memo"
					name="memo"
					placeholder="Optional note"
				/>
			</Field>
			<DialogActionRow>
				<Button disabled={isLoading || isCreatingType} type="submit">
					{getButtonLabel(isCreatingType, isLoading)}
				</Button>
			</DialogActionRow>
		</form>
	);
}
