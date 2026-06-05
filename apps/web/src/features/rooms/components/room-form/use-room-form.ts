import { useForm } from "@tanstack/react-form";
import z from "zod";

export interface RoomFormValues {
	memo?: string;
	name: string;
}

const roomFormSchema = z.object({
	name: z.string().min(1, "Room name is required"),
	memo: z.string(),
});

interface UseRoomFormOptions {
	defaultValues?: RoomFormValues;
	onSubmit: (values: RoomFormValues) => void;
}

export function useRoomForm({ onSubmit, defaultValues }: UseRoomFormOptions) {
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			memo: defaultValues?.memo ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				memo: value.memo ? value.memo : undefined,
			});
		},
		validators: {
			onSubmit: roomFormSchema,
		},
	});

	return { form };
}
