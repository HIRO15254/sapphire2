import { useEffect, useRef, useState } from "react";

const NEW_TYPE_VALUE = "__new__";

interface UseTypeComboboxProps {
	newTypeName: string;
	onNewTypeNameChange: (name: string) => void;
	onTypeChange: (id: string) => void;
	typeId: string;
	types: { id: string; name: string }[];
}

export function useTypeCombobox({
	newTypeName,
	onNewTypeNameChange,
	onTypeChange,
	typeId,
	types,
}: UseTypeComboboxProps) {
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

	const handleInputChange = (value: string) => {
		setInputValue(value);
		setIsFiltering(true);
		setIsOpen(true);
		onTypeChange("");
		onNewTypeNameChange("");
	};

	const handleInputFocus = () => setIsOpen(true);

	const handleInputBlur = (relatedTarget: HTMLElement | null) => {
		if (!relatedTarget?.closest('[data-slot="popover-content"]')) {
			setIsOpen(false);
		}
	};

	const handleKeyDown = (key: string) => {
		if (key === "Enter") {
			if (exactMatch) {
				handleSelect(exactMatch);
			} else if (canCreate) {
				handleCreate();
			}
		}
		if (key === "Escape") {
			setIsOpen(false);
		}
	};

	return {
		anchorRef,
		canCreate,
		contentWidth,
		exactMatch,
		filteredTypes,
		handleCreate,
		handleInputBlur,
		handleInputChange,
		handleInputFocus,
		handleKeyDown,
		handleSelect,
		inputValue,
		shouldShowPopover,
	};
}
