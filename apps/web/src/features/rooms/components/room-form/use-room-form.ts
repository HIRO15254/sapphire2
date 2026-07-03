import { useForm } from "@tanstack/react-form";
import z from "zod";
import {
	optionalNumericString,
	parseOptionalNumber,
} from "@/shared/lib/form-fields";

export interface RoomFormValues {
	latitude?: number;
	longitude?: number;
	memo?: string;
	name: string;
}

interface RoomFormDefaults {
	latitude?: number | null;
	longitude?: number | null;
	memo?: string;
	name: string;
}

const roomFormSchema = z
	.object({
		name: z.string().min(1, "Room name is required"),
		memo: z.string(),
		latitude: optionalNumericString({ min: -90, max: 90 }),
		longitude: optionalNumericString({ min: -180, max: 180 }),
	})
	.refine(
		(value) =>
			(value.latitude.trim() === "") === (value.longitude.trim() === ""),
		{
			message: "Both latitude and longitude are required",
			path: ["longitude"],
		}
	);

interface UseRoomFormOptions {
	defaultValues?: RoomFormDefaults;
	onSubmit: (values: RoomFormValues) => void;
}

function coordToField(value: number | null | undefined): string {
	return value === null || value === undefined ? "" : String(value);
}

export function useRoomForm({ onSubmit, defaultValues }: UseRoomFormOptions) {
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			memo: defaultValues?.memo ?? "",
			latitude: coordToField(defaultValues?.latitude),
			longitude: coordToField(defaultValues?.longitude),
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				memo: value.memo ? value.memo : undefined,
				latitude: parseOptionalNumber(value.latitude),
				longitude: parseOptionalNumber(value.longitude),
			});
		},
		validators: {
			onSubmit: roomFormSchema,
		},
	});

	// Coordinates are set as a pair from the LocationPicker (search / link / GPS),
	// never typed by hand. `null` clears both.
	const setCoords = (
		coords: { latitude: number; longitude: number } | null
	) => {
		form.setFieldValue("latitude", coords ? String(coords.latitude) : "");
		form.setFieldValue("longitude", coords ? String(coords.longitude) : "");
	};

	return { form, setCoords };
}
