import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import type { RoomFormValues } from "./use-room-form";
import { useRoomForm } from "./use-room-form";

interface RoomFormProps {
	defaultValues?: RoomFormValues;
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (rendered by the surrounding FormSheet toolbar) can submit it via the
	 * HTML `form` attribute.
	 */
	formId: string;
	onSubmit: (values: RoomFormValues) => void;
}

export function RoomForm({ onSubmit, defaultValues, formId }: RoomFormProps) {
	const { form } = useRoomForm({ onSubmit, defaultValues });

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
		</form>
	);
}
