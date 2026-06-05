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
import { useTypeCombobox } from "./use-type-combobox";

interface TypeComboboxProps {
	"aria-invalid"?: boolean;
	id?: string;
	newTypeName: string;
	onNewTypeNameChange: (name: string) => void;
	onTypeChange: (id: string) => void;
	reservedNames?: readonly string[];
	typeId: string;
	types: { id: string; name: string }[];
}

export function TypeCombobox({
	"aria-invalid": ariaInvalid,
	id,
	newTypeName,
	onNewTypeNameChange,
	onTypeChange,
	reservedNames,
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
		reservedNames,
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
