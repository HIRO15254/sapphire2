import type { ReactNode } from "react";
import { Field } from "@/shared/components/ui/field";
import { Textarea } from "@/shared/components/ui/textarea";

interface MemoFieldsProps {
	error?: ReactNode;
	onTextChange: (v: string) => void;
	text: string;
}

export function MemoFields({ error, onTextChange, text }: MemoFieldsProps) {
	return (
		<Field error={error} htmlFor="memo-text" label="Note" required>
			<Textarea
				id="memo-text"
				onChange={(e) => onTextChange(e.target.value)}
				value={text}
			/>
		</Field>
	);
}
