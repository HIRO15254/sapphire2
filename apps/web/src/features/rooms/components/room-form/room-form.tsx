import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { LocationPicker } from "./location-picker";
import type { RoomFormValues } from "./use-room-form";
import { useRoomForm } from "./use-room-form";

interface RoomFormProps {
	defaultValues?: {
		latitude?: number | null;
		longitude?: number | null;
		memo?: string;
		name: string;
	};
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (rendered by the surrounding FormSheet toolbar) can submit it via the
	 * HTML `form` attribute.
	 */
	formId: string;
	onSubmit: (values: RoomFormValues) => void;
}

function fieldToCoord(value: string): number | null {
	return value.trim() === "" ? null : Number(value);
}

export function RoomForm({ onSubmit, defaultValues, formId }: RoomFormProps) {
	const { form, setCoords } = useRoomForm({ onSubmit, defaultValues });

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Room name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Subscribe
				selector={(state) => ({
					latitude: state.values.latitude,
					longitude: state.values.longitude,
				})}
			>
				{({ latitude, longitude }) => (
					<LocationPicker
						latitude={fieldToCoord(latitude)}
						longitude={fieldToCoord(longitude)}
						onCoordsChange={setCoords}
					/>
				)}
			</form.Subscribe>
		</form>
	);
}
