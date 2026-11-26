import { useForm } from "@tanstack/react-form";
import { type ChangeEvent, type FormEvent, useState } from "react";
import z from "zod";
import type { GameGroup } from "@/features/games/hooks/use-game-masters";
import {
	duplicateLabelError,
	serverLabelError,
} from "@/features/games/utils/game-masters";
import { trpcErrorCode } from "@/shared/lib/query-failure";

export const BLIND_ROWS = [
	{ field: 1, name: "First blind" },
	{ field: 2, name: "Second blind" },
	{ field: 3, name: "Third blind" },
] as const;

type BlindField = (typeof BLIND_ROWS)[number]["field"];

export const ANTE_OPTIONS = [
	{ label: "Chosen with the stakes", value: "choose" },
	{ label: "All ante", value: "all" },
	{ label: "BB ante", value: "bb" },
	{ label: "No ante", value: "none" },
] as const;

type AnteChoice = (typeof ANTE_OPTIONS)[number]["value"];

const blindLabelSchema = z
	.string()
	.trim()
	.max(20, "Use 20 characters or fewer");

const groupFormSchema = z.object({
	ante: z.enum(["choose", "all", "bb", "none"]),
	blind1Label: blindLabelSchema,
	blind1Required: z.boolean(),
	blind2Label: blindLabelSchema,
	blind2Required: z.boolean(),
	blind3Label: blindLabelSchema,
	blind3Required: z.boolean(),
	label: z
		.string()
		.trim()
		.min(1, "Enter a name")
		.max(30, "Use 30 characters or fewer"),
});

export interface GroupFormSubmit {
	blind1Label: string | null;
	blind1Required: boolean;
	blind2Label: string | null;
	blind2Required: boolean;
	blind3Label: string | null;
	blind3Required: boolean;
	fixedAnteType: "all" | "bb" | "none" | null;
	label: string;
}

interface UseGroupFormOptions {
	group: GameGroup | null;
	groups: GameGroup[] | undefined;
	onSubmit: (values: GroupFormSubmit) => Promise<void>;
}

type ServerErrors = Partial<Record<"label" | `blind${BlindField}`, string>>;

function isStoredStakeConflict(error: unknown): boolean {
	return (
		trpcErrorCode(error) === "CONFLICT" &&
		error instanceof Error &&
		error.message.startsWith("Saved stakes")
	);
}

type GroupFormValues = z.input<typeof groupFormSchema>;

function toGroupSubmit(value: GroupFormValues): GroupFormSubmit {
	const blind = (field: BlindField) => {
		const label = value[`blind${field}Label`].trim();
		return {
			label: label || null,
			required: label !== "" && value[`blind${field}Required`],
		};
	};
	const [first, second, third] = [blind(1), blind(2), blind(3)];
	return {
		blind1Label: first.label,
		blind1Required: first.required,
		blind2Label: second.label,
		blind2Required: second.required,
		blind3Label: third.label,
		blind3Required: third.required,
		fixedAnteType: value.ante === "choose" ? null : value.ante,
		label: value.label.trim(),
	};
}

function submitErrors(
	error: unknown,
	group: GameGroup | null,
	value: GroupFormValues
): ServerErrors {
	const labelError = serverLabelError(error, "group");
	if (labelError) {
		return { label: labelError };
	}
	if (!(group && isStoredStakeConflict(error))) {
		return {};
	}
	const cleared: ServerErrors = {};
	for (const { field } of BLIND_ROWS) {
		const original = group[`blind${field}Label`];
		if (original && !value[`blind${field}Label`].trim()) {
			cleared[`blind${field}`] = `Saved stakes use ${original}.`;
		}
	}
	return cleared;
}

export function useGroupForm({ group, groups, onSubmit }: UseGroupFormOptions) {
	const [serverErrors, setServerErrors] = useState<ServerErrors>({});
	const form = useForm({
		defaultValues: {
			ante: (group?.fixedAnteType ?? "choose") as AnteChoice,
			blind1Label: group?.blind1Label ?? "",
			blind1Required: group?.blind1Required ?? false,
			blind2Label: group?.blind2Label ?? "",
			blind2Required: group?.blind2Required ?? false,
			blind3Label: group?.blind3Label ?? "",
			blind3Required: group?.blind3Required ?? false,
			label: group?.label ?? "",
		},
		onSubmit: async ({ value }) => {
			const duplicate = duplicateLabelError(
				groups,
				value.label,
				group?.id ?? null,
				"group"
			);
			if (duplicate) {
				setServerErrors({ label: duplicate });
				return;
			}
			try {
				await onSubmit(toGroupSubmit(value));
			} catch (error) {
				setServerErrors(submitErrors(error, group, value));
			}
		},
		validators: { onSubmit: groupFormSchema },
	});

	return {
		form,
		labelError: serverErrors.label,
		onAnteChange:
			(handleChange: (value: AnteChoice) => void) => (value: string) =>
				handleChange(value as AnteChoice),
		onBlindLabelChange:
			(field: BlindField, handleChange: (value: string) => void) =>
			(event: ChangeEvent<HTMLInputElement>) => {
				setServerErrors((current) => ({
					...current,
					[`blind${field}`]: undefined,
				}));
				handleChange(event.target.value);
				if (!event.target.value.trim()) {
					form.setFieldValue(`blind${field}Required`, false);
				}
			},
		onFormSubmit: (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			event.stopPropagation();
			form.handleSubmit();
		},
		onLabelChange:
			(handleChange: (value: string) => void) =>
			(event: ChangeEvent<HTMLInputElement>) => {
				setServerErrors((current) => ({ ...current, label: undefined }));
				handleChange(event.target.value);
			},
		serverBlindError: (field: BlindField) => serverErrors[`blind${field}`],
	};
}
