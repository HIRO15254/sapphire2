import type { ChangeEvent } from "react";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

export interface SelectOption {
	label: string;
	value: string;
}

interface SelectFieldProps {
	disabled?: boolean;
	error?: string;
	id: string;
	label: string;
	onValueChange: (value: string) => void;
	options: SelectOption[];
	required?: boolean;
	value: string;
}

export function SelectField({
	disabled,
	error,
	id,
	label,
	onValueChange,
	options,
	required,
	value,
}: SelectFieldProps) {
	return (
		<Field error={error} htmlFor={id} label={label} required={required}>
			<Select disabled={disabled} onValueChange={onValueChange} value={value}>
				<SelectTrigger id={id}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

interface TextFieldProps {
	error?: string;
	id: string;
	inputMode?: "decimal";
	label: string;
	onBlur: () => void;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	required?: boolean;
	type?: "date" | "datetime-local" | "text";
	value: string;
}

export function TextField({
	error,
	id,
	inputMode,
	label,
	onBlur,
	onChange,
	required,
	type = "text",
	value,
}: TextFieldProps) {
	return (
		<Field error={error} htmlFor={id} label={label} required={required}>
			<Input
				id={id}
				inputMode={inputMode}
				onBlur={onBlur}
				onChange={onChange}
				size="xl"
				type={type}
				value={value}
			/>
		</Field>
	);
}

interface MemoFieldProps {
	error?: string;
	id: string;
	label?: string;
	onBlur: () => void;
	onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
	value: string;
}

export function MemoField({
	error,
	id,
	label = "Memo",
	onBlur,
	onChange,
	value,
}: MemoFieldProps) {
	return (
		<Field error={error} htmlFor={id} label={label}>
			<Textarea
				id={id}
				onBlur={onBlur}
				onChange={onChange}
				rows={2}
				value={value}
			/>
		</Field>
	);
}

export function GroupLabel({ children, id }: { children: string; id: string }) {
	return (
		<span className="text-foreground text-sm font-medium" id={id}>
			{children}
		</span>
	);
}
