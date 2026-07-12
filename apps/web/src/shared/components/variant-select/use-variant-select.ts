import {
	MIX_VARIANT,
	MIX_VARIANT_LABEL,
} from "@sapphire2/db/constants/game-variants";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

/**
 * Sentinel Select value for the trailing "Add custom variant" item —
 * intercepted before onChange so it opens the creation sheet instead of
 * becoming the field value.
 */
export const ADD_CUSTOM_VALUE = "__add_custom_variant__";

// Mirrors gameVariant.create's server constraints so users get field-level
// errors instead of a server reject.
const customVariantFormSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	shortLabel: z.string().trim().max(15),
	groupId: z.string().min(1, "Required"),
});

interface UseVariantSelectArgs {
	/**
	 * Variant labels to hide from the options — used by the mix-games editor
	 * to keep one game in one group. The currently selected value is always
	 * kept so the control can render it.
	 */
	excludeVariants?: string[];
	/** Show the special "Mixed Game" mode entry (value: "mix"). */
	includeMix?: boolean;
	onChange: (variant: string) => void;
	value: string;
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
	const [isAddOpen, setIsAddOpen] = useState(false);

	const variantListOptions = trpc.gameVariant.list.queryOptions();
	const variantsQuery = useQuery(variantListOptions);
	const allVariants = variantsQuery.data ?? [];
	const groupsQuery = useQuery(trpc.gameGroup.list.queryOptions());
	const groups = groupsQuery.data ?? [];

	const excluded = new Set((excludeVariants ?? []).map(normalized));
	const keep = (candidate: string) =>
		normalized(candidate) === normalized(value) ||
		!excluded.has(normalized(candidate));

	// The user's variant rows are the whole option list (value = label).
	const variantOptions = allVariants
		.filter((row) => keep(row.label))
		.map((row) => ({ id: row.id, label: row.label }));

	const mixOption = includeMix
		? { value: MIX_VARIANT, label: MIX_VARIANT_LABEL }
		: null;

	// A frozen value whose definition no longer exists (deleted variant)
	// still needs an item, or the controlled Select renders blank.
	const isKnownValue =
		value === "" ||
		value === MIX_VARIANT ||
		allVariants.some((row) => row.label === value);
	const unknownValue = isKnownValue ? null : value;

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

	const handleValueChange = (next: string) => {
		if (next === ADD_CUSTOM_VALUE) {
			setIsAddOpen(true);
			return;
		}
		onChange(next);
	};

	return {
		form,
		formId,
		groups,
		handleValueChange,
		isAddOpen,
		isCreatePending: createMutation.isPending,
		isLoading: variantsQuery.isLoading || groupsQuery.isLoading,
		mixOption,
		setIsAddOpen,
		unknownValue,
		variantOptions,
	};
}
