import { useForm } from "@tanstack/react-form";
import { type ChangeEvent, type FormEvent, useState } from "react";
import z from "zod";
import type {
	GameGroup,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import {
	blindSummary,
	duplicateLabelError,
	MAX_MIX_STRUCTURES,
	serverLabelError,
} from "@/features/games/utils/game-masters";
import { trpcErrorCode } from "@/shared/lib/query-failure";

const variantFormSchema = z.object({
	groupId: z.string().min(1, "Choose a structure"),
	label: z
		.string()
		.trim()
		.min(1, "Enter a name")
		.max(30, "Use 30 characters or fewer"),
	shortLabel: z.string().trim().max(15, "Use 15 characters or fewer"),
});

export interface VariantFormSubmit {
	groupId: string;
	label: string;
	shortLabel: string | null;
}

interface UseVariantFormOptions {
	groups: GameGroup[];
	onSubmit: (values: VariantFormSubmit) => Promise<void>;
	variant: GameVariant | null;
	variants: GameVariant[] | undefined;
}

interface ServerErrors {
	groupId?: string;
	label?: string;
}

function isStructureLimit(error: unknown): boolean {
	return (
		trpcErrorCode(error) === "CONFLICT" &&
		error instanceof Error &&
		error.message.includes(`exceed ${MAX_MIX_STRUCTURES} game groups`)
	);
}

export function useVariantForm({
	groups,
	onSubmit,
	variant,
	variants,
}: UseVariantFormOptions) {
	const [serverErrors, setServerErrors] = useState<ServerErrors>({});
	const form = useForm({
		defaultValues: {
			groupId: variant?.groupId ?? groups[0]?.id ?? "",
			label: variant?.label ?? "",
			shortLabel: variant?.shortLabel ?? "",
		},
		onSubmit: async ({ value }) => {
			const duplicate = duplicateLabelError(
				variants,
				value.label,
				variant?.id ?? null,
				"variant"
			);
			if (duplicate) {
				setServerErrors({ label: duplicate });
				return;
			}
			try {
				await onSubmit({
					groupId: value.groupId,
					label: value.label.trim(),
					shortLabel: value.shortLabel.trim() || null,
				});
			} catch (error) {
				const labelError = serverLabelError(error, "variant");
				if (labelError) {
					setServerErrors({ label: labelError });
				} else if (isStructureLimit(error)) {
					setServerErrors({
						groupId: `A mix can span up to ${MAX_MIX_STRUCTURES} structures`,
					});
				}
			}
		},
		validators: { onSubmit: variantFormSchema },
	});

	const clearing =
		(name: keyof ServerErrors, handleChange: (value: string) => void) =>
		(value: string) => {
			setServerErrors((current) => ({ ...current, [name]: undefined }));
			handleChange(value);
		};

	return {
		form,
		groupError: serverErrors.groupId,
		labelError: serverErrors.label,
		onFormSubmit: (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			event.stopPropagation();
			form.handleSubmit();
		},
		onGroupChange: (handleChange: (value: string) => void) =>
			clearing("groupId", handleChange),
		onTextChange:
			(
				name: keyof ServerErrors | null,
				handleChange: (value: string) => void
			) =>
			(event: ChangeEvent<HTMLInputElement>) => {
				if (name) {
					setServerErrors((current) => ({ ...current, [name]: undefined }));
				}
				handleChange(event.target.value);
			},
		structureHint: (groupId: string) => {
			const group = groups.find((row) => row.id === groupId);
			return group ? `Stakes: ${blindSummary(group, true)}` : undefined;
		},
	};
}
