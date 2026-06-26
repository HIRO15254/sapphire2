import { IconCurrentLocation } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
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

const LOCATION_STATUS_MESSAGE: Partial<Record<string, string>> = {
	prompting: "Getting current location",
	denied: "Location permission denied",
	unavailable: "Location unavailable",
};

export function RoomForm({ onSubmit, defaultValues, formId }: RoomFormProps) {
	const { form, captureLocation, locationStatus } = useRoomForm({
		onSubmit,
		defaultValues,
	});

	const statusMessage = LOCATION_STATUS_MESSAGE[locationStatus];

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
			<div className="grid grid-cols-2 gap-4">
				<form.Field name="latitude">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Latitude"
						>
							<Input
								id={field.name}
								inputMode="decimal"
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="longitude">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Longitude"
						>
							<Input
								id={field.name}
								inputMode="decimal"
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>
			<div className="flex items-center gap-3">
				<Button
					onClick={captureLocation}
					size="sm"
					type="button"
					variant="outline"
				>
					<IconCurrentLocation size={16} />
					Use current location
				</Button>
				{statusMessage && (
					<span
						className={
							locationStatus === "prompting"
								? "text-muted-foreground text-sm"
								: "text-destructive text-sm"
						}
					>
						{statusMessage}
					</span>
				)}
			</div>
		</form>
	);
}
