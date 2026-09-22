import { useEffect, useRef, useState } from "react";

interface TagItemBase {
	id: string;
	name: string;
}

interface UseTagPickerBaseOptions<TTag extends TagItemBase> {
	availableTags?: TTag[];
	onAdd: (tag: TTag) => void;
	onCreateTag?: (name: string) => Promise<TTag>;
	onRemove: (tag: TTag) => void;
	selectedTags: TTag[];
}

interface UseTagPickerBaseResult<TTag extends TagItemBase> {
	anchorRef: React.RefObject<HTMLDivElement | null>;
	canCreate: boolean;
	closeAndReset: () => void;
	contentWidth: number | undefined;
	filteredTags: TTag[];
	focusInput: () => void;
	handleInputSubmit: () => Promise<void>;
	handleTagSelect: (tag: TTag) => void;
	inputRef: React.RefObject<HTMLInputElement | null>;
	inputValue: string;
	isCreatingTag: boolean;
	isOpen: boolean;
	normalizedInput: string;
	onInputChange: (value: string) => void;
	onOpenChange: (open: boolean) => void;
	shouldRenderPopover: boolean;
}

export function useTagPickerBase<TTag extends TagItemBase>({
	availableTags,
	onAdd,
	onCreateTag,
	onRemove: _onRemove,
	selectedTags,
}: UseTagPickerBaseOptions<TTag>): UseTagPickerBaseResult<TTag> {
	const [inputValue, setInputValue] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [contentWidth, setContentWidth] = useState<number>();
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const isCreatingTagRef = useRef(false);
	const anchorRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const normalizedInput = inputValue.trim();
	const allTags = availableTags ?? [];
	const selectedTagIds = new Set(selectedTags.map((tag) => tag.id));
	const filteredTags = allTags.filter((tag) => {
		if (selectedTagIds.has(tag.id)) {
			return false;
		}
		if (!normalizedInput) {
			return true;
		}
		return tag.name.toLowerCase().includes(normalizedInput.toLowerCase());
	});
	const matchingTag = allTags.find(
		(tag) => tag.name.toLowerCase() === normalizedInput.toLowerCase()
	);
	const canCreate = Boolean(onCreateTag && normalizedInput && !matchingTag);
	const shouldRenderPopover =
		isOpen && (allTags.length > 0 || Boolean(normalizedInput));

	useEffect(() => {
		if (!(shouldRenderPopover && anchorRef.current)) {
			return;
		}
		setContentWidth(anchorRef.current.offsetWidth);
	}, [shouldRenderPopover]);

	const focusInput = () => {
		inputRef.current?.focus();
	};

	const closeAndReset = () => {
		setInputValue("");
		setIsOpen(false);
	};

	const handleTagSelect = (tag: TTag) => {
		onAdd(tag);
		closeAndReset();
		focusInput();
	};

	const handleInputSubmit = async () => {
		if (!normalizedInput) {
			return;
		}

		if (matchingTag) {
			if (!selectedTagIds.has(matchingTag.id)) {
				handleTagSelect(matchingTag);
			}
			return;
		}

		if (!onCreateTag || isCreatingTagRef.current) {
			return;
		}

		isCreatingTagRef.current = true;
		setIsCreatingTag(true);
		try {
			const createdTag = await onCreateTag(normalizedInput);
			handleTagSelect(createdTag);
		} finally {
			isCreatingTagRef.current = false;
			setIsCreatingTag(false);
		}
	};

	return {
		anchorRef,
		canCreate,
		closeAndReset,
		contentWidth,
		filteredTags,
		focusInput,
		handleInputSubmit,
		handleTagSelect,
		inputRef,
		inputValue,
		isCreatingTag,
		isOpen,
		normalizedInput,
		onInputChange: setInputValue,
		onOpenChange: setIsOpen,
		shouldRenderPopover,
	};
}
