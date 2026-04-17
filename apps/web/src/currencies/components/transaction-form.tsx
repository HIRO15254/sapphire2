import { useEffect, useRef, useState } from "react";
import { useTransactionTypes } from "@/currencies/hooks/use-transaction-types";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { Button } from "@/shared/components/ui/button";
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
	const [typeInput, setTypeInput] = useState("");
	const [selectedTypeId, setSelectedTypeId] = useState(
		defaultValues?.transactionTypeId ?? ""
	);
	const [isTypeOpen, setIsTypeOpen] = useState(false);
	const [typeDropdownWidth, setTypeDropdownWidth] = useState<number>();
	const typeAnchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (selectedTypeId && !typeInput) {
			const found = types.find((t) => t.id === selectedTypeId);
			if (found) {
				setTypeInput(found.name);
			}
		}
	}, [types, selectedTypeId, typeInput]);

	useEffect(() => {
		if (!(isTypeOpen && typeAnchorRef.current)) {
			return;
		}
		setTypeDropdownWidth(typeAnchorRef.current.offsetWidth);
	}, [isTypeOpen]);

	const normalizedTypeInput = typeInput.trim();
	const filteredTypes = types.filter(
		(t) =>
			!normalizedTypeInput ||
			t.name.toLowerCase().includes(normalizedTypeInput.toLowerCase())
	);
	const exactMatchType = types.find(
		(t) => t.name.toLowerCase() === normalizedTypeInput.toLowerCase()
	);
	const canCreateType = Boolean(normalizedTypeInput && !exactMatchType);
	const shouldShowTypePopover =
		isTypeOpen && (types.length > 0 || Boolean(normalizedTypeInput));

	const handleSelectType = (type: { id: string; name: string }) => {
		setSelectedTypeId(type.id);
		setTypeInput(type.name);
		setIsTypeOpen(false);
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const amount = Number(formData.get("amount"));
		const transactedAt = formData.get("transactedAt") as string;
		const memo = (formData.get("memo") as string) || undefined;

		let transactionTypeId = selectedTypeId;

		if (!transactionTypeId) {
			if (exactMatchType) {
				transactionTypeId = exactMatchType.id;
			} else if (normalizedTypeInput) {
				const created = await createType(normalizedTypeInput);
				transactionTypeId = created.id;
			} else {
				return;
			}
		}

		onSubmit({ amount, transactionTypeId, transactedAt, memo });
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
			<Field htmlFor="typeInput" label="Type" required>
				<Popover
					modal={false}
					onOpenChange={setIsTypeOpen}
					open={shouldShowTypePopover}
				>
					<PopoverAnchor asChild>
						<div ref={typeAnchorRef}>
							<Input
								aria-expanded={shouldShowTypePopover}
								aria-label="Search or create transaction type"
								autoComplete="off"
								id="typeInput"
								onChange={(e) => {
									setTypeInput(e.target.value);
									setSelectedTypeId("");
									setIsTypeOpen(true);
								}}
								onFocus={() => setIsTypeOpen(true)}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										setIsTypeOpen(false);
									}
								}}
								placeholder="Select or create type..."
								required
								role="combobox"
								value={typeInput}
							/>
						</div>
					</PopoverAnchor>
					{shouldShowTypePopover ? (
						<PopoverContent
							align="start"
							className="p-0"
							onOpenAutoFocus={(e) => e.preventDefault()}
							style={typeDropdownWidth ? { width: typeDropdownWidth } : undefined}
						>
							<Command shouldFilter={false}>
								<CommandList>
									{filteredTypes.length === 0 && !canCreateType ? (
										<CommandEmpty>No matching types.</CommandEmpty>
									) : null}
									{filteredTypes.map((t) => (
										<CommandItem
											key={t.id}
											onMouseDown={(e) => e.preventDefault()}
											onSelect={() => handleSelectType(t)}
											value={t.name}
										>
											{t.name}
										</CommandItem>
									))}
									{canCreateType ? (
										<CommandItem
											onMouseDown={(e) => e.preventDefault()}
											onSelect={async () => {
												const created = await createType(normalizedTypeInput);
												handleSelectType(created);
											}}
											value={`create-${normalizedTypeInput}`}
										>
											Create &quot;{normalizedTypeInput}&quot;
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
