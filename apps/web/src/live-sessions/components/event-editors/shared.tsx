import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

export type SessionType = "cash_game" | "tournament";

export interface EditorBaseProps {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
	onTimeUpdate: (occurredAt: number) => void;
	sessionType: SessionType;
}

export function TimeField({
	error,
	onChange,
	value,
}: {
	error: string | null;
	onChange: (v: string) => void;
	value: string;
}) {
	return (
		<Field error={error ?? undefined} htmlFor="edit-time" label="Time">
			<Input
				id="edit-time"
				onChange={(e) => onChange(e.target.value)}
				type="time"
				value={value}
			/>
		</Field>
	);
}
