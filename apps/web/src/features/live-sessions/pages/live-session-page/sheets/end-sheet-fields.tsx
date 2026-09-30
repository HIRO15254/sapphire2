import type { ReactNode } from "react";
import { Field } from "@/shared/components/ui/field";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { CRYST_FIELD } from "../cryst-controls";

interface EndNumericFieldProps {
	error?: string;
	id: string;
	label: string;
	name: string;
	onBlur: () => void;
	onChange: (value: string) => void;
	required?: boolean;
	value: string;
}

export function EndNumericField({
	error,
	id,
	label,
	name,
	onBlur,
	onChange,
	required = false,
	value,
}: EndNumericFieldProps) {
	return (
		<Field
			className="min-w-0 gap-1.5"
			error={error}
			htmlFor={id}
			label={label}
			required={required}
		>
			<input
				className={`${CRYST_FIELD} h-[var(--m-control)] w-full px-2.5 font-mono tabular-nums`}
				id={id}
				{...NO_INPUT_SUGGESTIONS}
				inputMode="numeric"
				name={name}
				onBlur={onBlur}
				onChange={(e) => onChange(e.target.value)}
				type="text"
				value={value}
			/>
		</Field>
	);
}

export function EndSheetNote({ children }: { children: ReactNode }) {
	return (
		<p className="text-pretty text-[length:var(--m-text-footnote)] text-muted-foreground leading-[var(--m-leading-body)]">
			{children}
		</p>
	);
}

export const END_SHEET_FOOTER =
	"You can edit this from history later. This closes the record.";
