import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

// Mirrors gameVariant.create's server constraints so users get field-level
// errors instead of a server reject.
const customVariantFormSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	shortLabel: z.string().trim().max(15),
	groupId: z.string().min(1, "Required"),
});

// Legacy mix-mode key frozen into old rows before named mix masters existed
// (see @sapphire2/db/constants/game-variants MIX_VARIANT) — kept recognized
// here without importing the constant, since it is never offered as a menu
// item anymore (only real mix master labels are).
const LEGACY_MIX_VALUE = "mix";

interface UseVariantSelectArgs {
	/**
	 * Variant labels to hide from the options — used by the mix-games editor
	 * to keep one game in one group. Mix master options are never hidden by
	 * this filter (a mix is not a member of any group). The currently
	 * selected value is always kept so the control can render it.
	 */
	excludeVariants?: string[];
	/** Show the user's named mix masters (HORSE / 8-Game / 10-Game / custom). */
	includeMix?: boolean;
	onChange: (variant: string) => void;
	value: string;
}

function normalized(variant: string): string {
	return variant.trim().toLowerCase();
}

/**
 * Type-to-filter combobox state (Input + Popover + Command, the repo's
 * combobox convention — see currencies' type-combobox). The input's text is
 * a local draft: the field value only changes on an explicit selection, and
 * an unresolved draft reverts to the current value on blur/escape.
 */
export function useVariantSelect({
	excludeVariants,
	includeMix = false,
	onChange,
	value,
}: UseVariantSelectArgs) {
	const queryClient = useQueryClient();
	const formId = useId();
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [inputValue, setInputValue] = useState(value);
	const [isFiltering, setIsFiltering] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [contentWidth, setContentWidth] = useState<number>();
	const anchorRef = useRef<HTMLDivElement>(null);

	// The value prop is the display label (self-freezing select) — keep the
	// draft text in sync whenever the committed value changes (selection,
	// mix-master reseed, external form reset).
	useEffect(() => {
		setInputValue(value);
		setIsFiltering(false);
	}, [value]);

	const variantListOptions = trpc.gameVariant.list.queryOptions();
	const variantsQuery = useQuery(variantListOptions);
	const allVariants = variantsQuery.data ?? [];
	const groupsQuery = useQuery(trpc.gameGroup.list.queryOptions());
	const groups = groupsQuery.data ?? [];
	const mixesQuery = useQuery(trpc.gameMix.list.queryOptions());
	const allMixes = mixesQuery.data ?? [];

	const excluded = new Set((excludeVariants ?? []).map(normalized));
	const keep = (candidate: string) =>
		normalized(candidate) === normalized(value) ||
		!excluded.has(normalized(candidate));

	// The user's variant rows are the whole option list (value = label).
	const variantOptions = allVariants
		.filter((row) => keep(row.label))
		.map((row) => ({ id: row.id, label: row.label }));

	// The user's named mix masters (value = label, self-freezing like plain
	// variants). Never filtered by excludeVariants — a mix is not a member of
	// any single group, so the "one game, one group" exclusion doesn't apply.
	const mixOptions = includeMix
		? allMixes.map((row) => ({ id: row.id, label: row.label }))
		: [];

	// Typed filter (manual — Command mounts with shouldFilter=false). Only
	// narrows while the user is actively typing a draft; a freshly opened
	// popover lists everything even though the input shows the current value.
	const query = isFiltering ? normalized(inputValue) : "";
	const matches = (label: string) =>
		query === "" || normalized(label).includes(query);
	const filteredVariantOptions = variantOptions.filter((o) => matches(o.label));
	const filteredMixOptions = mixOptions.filter((o) => matches(o.label));

	// A frozen value whose definition no longer exists (deleted variant) is
	// still rendered by the input (its text is the raw value), but callers can
	// use this to hint that the label no longer matches a master row. Mix
	// labels and the legacy "mix" mode key are always known.
	const isKnownValue =
		value === "" ||
		normalized(value) === LEGACY_MIX_VALUE ||
		allVariants.some((row) => row.label === value) ||
		allMixes.some((row) => normalized(row.label) === normalized(value));
	const unknownValue = isKnownValue ? null : value;

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
			setIsAddOpen(false);
			form.reset();
			onChange(created.label);
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
	};

	const handleSelect = (label: string) => {
		setIsOpen(false);
		setIsFiltering(false);
		// Cleared first so pick-and-reset mounts (value stays "") end up empty;
		// controlled mounts re-sync to the new value via the effect above.
		setInputValue("");
		onChange(label);
	};

	const handleInputChange = (text: string) => {
		setInputValue(text);
		setIsFiltering(true);
		setIsOpen(true);
	};

	const handleInputFocus = () => setIsOpen(true);

	const handleInputBlur = (relatedTarget: HTMLElement | null) => {
		if (!relatedTarget?.closest('[data-slot="popover-content"]')) {
			setIsOpen(false);
			revertDraft();
		}
	};

	const handleKeyDown = (key: string) => {
		if (key === "Enter") {
			const pool = [...filteredVariantOptions, ...filteredMixOptions];
			const exact = pool.find(
				(o) => normalized(o.label) === normalized(inputValue)
			);
			const target = exact ?? (pool.length === 1 ? pool[0] : undefined);
			if (target) {
				handleSelect(target.label);
			}
			return;
		}
		if (key === "Escape") {
			setIsOpen(false);
			revertDraft();
		}
	};

	// "Add custom variant" action item: an unresolved draft that matches no
	// option is almost always the name the user wanted to create — seed it.
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
		anchorRef,
		contentWidth,
		filteredMixOptions,
		filteredVariantOptions,
		form,
		formId,
		groups,
		handleInputBlur,
		handleInputChange,
		handleInputFocus,
		handleKeyDown,
		handleOpenAdd,
		handleSelect,
		inputValue,
		isAddOpen,
		isCreatePending: createMutation.isPending,
		isLoading:
			variantsQuery.isLoading || groupsQuery.isLoading || mixesQuery.isLoading,
		mixOptions,
		setIsAddOpen,
		shouldShowPopover,
		unknownValue,
		variantOptions,
	};
}
