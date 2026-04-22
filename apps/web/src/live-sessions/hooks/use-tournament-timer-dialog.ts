import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import { z } from "zod";

const schema = z.object({
	timerStartedAt: z.string().min(1, "Required"),
});

function toDatetimeLocalValue(value: Date | string | number | null): string {
	const date = value ? new Date(value) : new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface UseTournamentTimerDialogOptions {
	onSubmit: (timerStartedAt: Date) => void;
	open: boolean;
	timerStartedAt: Date | string | number | null;
}

export function useTournamentTimerDialog({
	open,
	timerStartedAt,
	onSubmit,
}: UseTournamentTimerDialogOptions) {
	const form = useForm({
		defaultValues: {
			timerStartedAt: toDatetimeLocalValue(timerStartedAt),
		},
		onSubmit: ({ value }) => {
			const parsed = new Date(value.timerStartedAt);
			if (!Number.isNaN(parsed.getTime())) {
				onSubmit(parsed);
			}
		},
		validators: {
			onSubmit: schema,
		},
	});

	useEffect(() => {
		if (open) {
			form.setFieldValue(
				"timerStartedAt",
				toDatetimeLocalValue(timerStartedAt)
			);
		}
	}, [open, timerStartedAt, form]);

	return { form };
}
