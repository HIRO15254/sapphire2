import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import z from "zod";
import { useGeolocation } from "@/shared/hooks/use-geolocation";
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
	const { request, coords, status } = useGeolocation({ enabled: false });

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

	// A captured GPS fix lands asynchronously; mirror it into the editable
	// lat/lng fields so the user sees (and can adjust) the captured coordinates.
	useEffect(() => {
		if (coords) {
			form.setFieldValue("latitude", String(coords.latitude));
			form.setFieldValue("longitude", String(coords.longitude));
		}
	}, [coords, form]);

	return { form, captureLocation: request, locationStatus: status };
}
