import { GAME_VARIANTS } from "@sapphire2/db/constants/game-variants";
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

// Mirrors gameVariant.create's server constraints (label 1-30, blind labels
// <= 20 chars) so users get field-level errors instead of a server reject.
const customVariantFormSchema = z.object({
	label: z.string().trim().min(1, "Required").max(30),
	blind1Label: z.string().trim().max(20),
	blind2Label: z.string().trim().max(20),
	blind3Label: z.string().trim().max(20),
});

interface UseVariantSelectArgs {
	/**
	 * Variants (preset keys or custom labels) to hide from the options —
	 * used by the mix-games editor to keep one game in one group. The
	 * currently selected value is always kept so the control can render it.
	 */
	excludeVariants?: string[];
	/** Show the special "mix" preset (only where a mix editor exists). */
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

	const listQueryOptions = trpc.gameVariant.list.queryOptions();
	const customVariantsQuery = useQuery(listQueryOptions);
	const allCustomVariants = customVariantsQuery.data ?? [];

	const excluded = new Set((excludeVariants ?? []).map(normalized));
	const keep = (candidate: string) =>
		normalized(candidate) === normalized(value) ||
		!excluded.has(normalized(candidate));

	const presets = Object.entries(GAME_VARIANTS)
		.filter(([key, def]) => (includeMix || !def.isMix) && keep(key))
		.map(([key, def]) => ({ key, label: def.label }));

	const customVariants = allCustomVariants.filter((row) => keep(row.label));

	// A frozen value whose definition no longer exists (deleted custom
	// variant) still needs an item, or the controlled Select renders blank.
	const isKnownValue =
		value === "" ||
		Object.hasOwn(GAME_VARIANTS, value) ||
		allCustomVariants.some((row) => row.label === value);
	const unknownValue = isKnownValue ? null : value;

	const createMutation = useMutation({
		mutationFn: (input: {
			blind1Label: string | null;
			blind2Label: string | null;
			blind3Label: string | null;
			label: string;
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
			invalidateTargets(queryClient, [{ queryKey: listQueryOptions.queryKey }]),
	});

	const form = useForm({
		defaultValues: {
			label: "",
			blind1Label: "",
			blind2Label: "",
			blind3Label: "",
		},
		onSubmit: ({ value: formValue }) => {
			createMutation.mutate({
				label: formValue.label.trim(),
				blind1Label: formValue.blind1Label.trim() || null,
				blind2Label: formValue.blind2Label.trim() || null,
				blind3Label: formValue.blind3Label.trim() || null,
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
		customVariants,
		form,
		formId,
		handleValueChange,
		isAddOpen,
		isCreatePending: createMutation.isPending,
		presets,
		setIsAddOpen,
		unknownValue,
	};
}
