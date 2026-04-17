import { useEffect, useRef, useState } from "react";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { Input } from "@/shared/components/ui/input";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/shared/components/ui/popover";

interface TransactionType {
	id: string;
	name: string;
}

interface TransactionTypeInputProps {
	availableTypes: TransactionType[];
	id?: string;
	onChange: (id: string) => void;
	onCreateType?: (name: string) => Promise<TransactionType>;
	placeholder?: string;
	value: string;
}

export function TransactionTypeInput({
	availableTypes,
	id,
	onChange,
	onCreateType,
	placeholder = "Select or create type...",
	value,
}: TransactionTypeInputProps) {
	const [inputValue, setInputValue] = useState(
		() => availableTypes.find((t) => t.id === value)?.name ?? ""
	);
	const [isOpen, setIsOpen] = useState(false);
	const [contentWidth, setContentWidth] = useState<number>();
	const anchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!value) {
			return;
		}
		const typeName = availableTypes.find((t) => t.id === value)?.name;
		if (typeName) {
			setInputValue(typeName);
		}
	}, [value, availableTypes]);

	useEffect(() => {
		if (!(isOpen && anchorRef.current)) {
			return;
		}
		setContentWidth(anchorRef.current.offsetWidth);
	}, [isOpen]);

	const normalizedInput = inputValue.trim();
	const filteredTypes = availableTypes.filter(
		(t) =>
			!normalizedInput ||
			t.name.toLowerCase().includes(normalizedInput.toLowerCase())
	);
	const matchingType = availableTypes.find(
		(t) => t.name.toLowerCase() === normalizedInput.toLowerCase()
	);
	const canCreate = Boolean(onCreateType && normalizedInput && !matchingType);
	const shouldRenderPopover =
		isOpen && (availableTypes.length > 0 || Boolean(normalizedInput));

	const handleSelect = (type: TransactionType) => {
		setInputValue(type.name);
		onChange(type.id);
		setIsOpen(false);
	};

	const handleCreate = async () => {
		if (!(normalizedInput && onCreateType)) {
			return;
		}
		const created = await onCreateType(normalizedInput);
		handleSelect(created);
	};

	return (
		<Popover modal={false} onOpenChange={setIsOpen} open={shouldRenderPopover}>
			<PopoverAnchor asChild>
				<div ref={anchorRef}>
					<Input
						aria-expanded={shouldRenderPopover}
						autoComplete="off"
						id={id}
						onChange={(e) => {
							setInputValue(e.target.value);
							onChange("");
							setIsOpen(true);
						}}
						onFocus={() => setIsOpen(true)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								if (matchingType) {
									handleSelect(matchingType);
								} else {
									handleCreate().catch(() => undefined);
								}
							}
							if (e.key === "Escape") {
								setIsOpen(false);
							}
						}}
						placeholder={placeholder}
						role="combobox"
						value={inputValue}
					/>
				</div>
			</PopoverAnchor>
			{shouldRenderPopover ? (
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
									onSelect={() => handleCreate().catch(() => undefined)}
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
