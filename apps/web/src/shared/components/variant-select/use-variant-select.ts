import { MIX_VARIANT } from "@sapphire2/db/constants/game-variants";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { GAME_MASTERS_STALE_TIME_MS } from "@/shared/hooks/use-game-groups";
import { invalidateTargets, updateQueryItems } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

const customVariantFormSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	shortLabel: z.string().trim().max(15),
	groupId: z.string().min(1, "Required"),
});

interface UseVariantSelectArgs {
	excludeVariants?: string[];
	includeMix?: boolean;
	onChange: (variant: string) => void;
	value: string;
}

type VariantOptionKind = "create" | "mix" | "variant";

function optionValue(kind: VariantOptionKind, id: string): string {
	return `${kind}:${id}`;
}

function normalized(variant: string): string {
	return variant.trim().toLowerCase();
}

export function useVariantSelect({
	excludeVariants,
	includeMix = false,
	onChange,
	value,
}: UseVariantSelectArgs) {
	const queryClient = useQueryClient();
	const formId = useId();
	const listboxId = `${formId}-listbox`;
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [inputValue, setInputValue] = useState(value);
	const [isFiltering, setIsFiltering] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [activeOptionValue, setActiveOptionValue] = useState<string | null>(
		null
	);
	const [contentWidth, setContentWidth] = useState<number>();
	const anchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setInputValue(value);
		setIsFiltering(false);
		setActiveOptionValue(null);
	}, [value]);

	const variantListOptions = trpc.gameVariant.list.queryOptions();
	const variantsQuery = useQuery({
		...variantListOptions,
		staleTime: GAME_MASTERS_STALE_TIME_MS,
	});
	const allVariants = variantsQuery.data ?? [];
	const groupsQuery = useQuery({
		...trpc.gameGroup.list.queryOptions(),
		staleTime: GAME_MASTERS_STALE_TIME_MS,
	});
	const groups = groupsQuery.data ?? [];
	const mixesQuery = useQuery({
		...trpc.gameMix.list.queryOptions(),
		staleTime: GAME_MASTERS_STALE_TIME_MS,
	});
	const allMixes = mixesQuery.data ?? [];

	const excluded = new Set((excludeVariants ?? []).map(normalized));
	const keep = (candidate: string) =>
		normalized(candidate) === normalized(value) ||
		!excluded.has(normalized(candidate));

	const variantOptions = allVariants
		.filter((row) => keep(row.label))
		.map((row) => ({ id: row.id, label: row.label }));

	const mixOptions = includeMix
		? allMixes.map((row) => ({ id: row.id, label: row.label }))
		: [];

	const query = isFiltering ? normalized(inputValue) : "";
	const matches = (label: string) =>
		query === "" || normalized(label).includes(query);
	const filteredVariantOptions = variantOptions.filter((o) => matches(o.label));
	const filteredMixOptions = mixOptions.filter((o) => matches(o.label));
	const navigableOptions = [
		...filteredVariantOptions.map((option) => ({
			id: option.id,
			kind: "variant" as const,
			label: option.label,
			value: optionValue("variant", option.id),
		})),
		...filteredMixOptions.map((option) => ({
			id: option.id,
			kind: "mix" as const,
			label: option.label,
			value: optionValue("mix", option.id),
		})),
		{
			id: "custom",
			kind: "create" as const,
			label: null,
			value: optionValue("create", "custom"),
		},
	];
	const activeOption = navigableOptions.find(
		(option) => option.value === activeOptionValue
	);
	const getOptionId = (kind: VariantOptionKind, id: string) =>
		`${listboxId}-${kind}-${id}`;
	const getOptionValue = (kind: VariantOptionKind, id: string) =>
		optionValue(kind, id);
	const activeOptionId = activeOption
		? getOptionId(activeOption.kind, activeOption.id)
		: undefined;

	const isKnownValue =
		value === "" ||
		normalized(value) === MIX_VARIANT ||
		allVariants.some((row) => row.label === value) ||
		allMixes.some((row) => normalized(row.label) === normalized(value));

	const shouldShowPopover = isOpen;

	useEffect(() => {
		if (!(shouldShowPopover && anchorRef.current)) {
			return;
		}
		setContentWidth(anchorRef.current.offsetWidth);
	}, [shouldShowPopover]);

	const createMutation = useMutation({
		mutationFn: (input: {
			groupId: string;
			label: string;
			shortLabel: string | null;
		}) => trpcClient.gameVariant.create.mutate(input),
		onSuccess: (created) => {
			updateQueryItems(queryClient, variantListOptions.queryKey, (old) => [
				...old,
				created,
			]);
			setIsAddOpen(false);
			form.reset();
			if (created) {
				onChange(created.label);
			}
		},
		onError: () => {
			toast.error("Failed to create custom variant");
		},
		onSettled: () =>
			invalidateTargets(queryClient, [
				{ queryKey: variantListOptions.queryKey },
			]),
	});

	const form = useForm({
		defaultValues: {
			label: "",
			shortLabel: "",
			groupId: "",
		},
		onSubmit: ({ value: formValue }) => {
			createMutation.mutate({
				label: formValue.label.trim(),
				shortLabel: formValue.shortLabel.trim() || null,
				groupId: formValue.groupId,
			});
		},
		validators: {
			onSubmit: customVariantFormSchema,
		},
	});

	const revertDraft = () => {
		setInputValue(value);
		setIsFiltering(false);
		setActiveOptionValue(null);
	};

	const handleSelect = (label: string) => {
		setIsOpen(false);
		setIsFiltering(false);
		setActiveOptionValue(null);
		if (normalized(label) === normalized(value)) {
			setInputValue(value);
			return;
		}
		setInputValue("");
		onChange(label);
	};

	const handleInputChange = (text: string) => {
		setInputValue(text);
		setIsFiltering(true);
		setIsOpen(true);
		setActiveOptionValue(null);
	};

	const handleInputFocus = () => {
		setIsOpen(true);
		setActiveOptionValue(null);
	};

	const handleInputBlur = (relatedTarget: HTMLElement | null) => {
		if (!relatedTarget?.closest('[data-slot="popover-content"]')) {
			setIsOpen(false);
			revertDraft();
		}
	};

	const moveActiveOption = (direction: 1 | -1) => {
		const currentIndex = navigableOptions.findIndex(
			(option) => option.value === activeOptionValue
		);
		let nextIndex: number;
		if (currentIndex === -1) {
			nextIndex = direction === 1 ? 0 : navigableOptions.length - 1;
		} else {
			nextIndex =
				(currentIndex + direction + navigableOptions.length) %
				navigableOptions.length;
		}
		setIsOpen(true);
		const nextOption = navigableOptions[nextIndex];
		if (!nextOption) {
			return;
		}
		setActiveOptionValue(nextOption.value);
	};

	const handleEnterKey = () => {
		if (activeOption?.kind === "create") {
			handleOpenAdd();
			return;
		}
		if (activeOption?.label) {
			handleSelect(activeOption.label);
			return;
		}
		const pool = [...filteredVariantOptions, ...filteredMixOptions];
		const exact = pool.find(
			(option) => normalized(option.label) === normalized(inputValue)
		);
		const target = exact ?? (pool.length === 1 ? pool[0] : undefined);
		if (target) {
			handleSelect(target.label);
		}
	};

	const handleKeyDown = (key: string): boolean => {
		if (key === "ArrowDown") {
			moveActiveOption(1);
			return true;
		}
		if (key === "ArrowUp") {
			moveActiveOption(-1);
			return true;
		}
		if (key === "Enter") {
			handleEnterKey();
			return true;
		}
		if (key === "Escape") {
			setIsOpen(false);
			revertDraft();
			return true;
		}
		return false;
	};

	const handleOpenAdd = () => {
		const draft = inputValue.trim();
		const isExisting = [...variantOptions, ...mixOptions].some(
			(o) => normalized(o.label) === normalized(draft)
		);
		if (isFiltering && draft !== "" && !isExisting) {
			form.setFieldValue("label", draft);
		}
		setIsOpen(false);
		revertDraft();
		setIsAddOpen(true);
	};

	return {
		activeOptionId,
		activeOptionValue,
		anchorRef,
		contentWidth,
		filteredMixOptions,
		filteredVariantOptions,
		form,
		formId,
		groups,
		getOptionId,
		getOptionValue,
		handleInputBlur,
		handleInputChange,
		handleInputFocus,
		handleKeyDown,
		handleOpenAdd,
		handleSelect,
		inputValue,
		isAddOpen,
		isCreatePending: createMutation.isPending,
		isKnownValue,
		isLoading:
			variantsQuery.isLoading || groupsQuery.isLoading || mixesQuery.isLoading,
		listboxId,
		setIsAddOpen,
		shouldShowPopover,
	};
}
