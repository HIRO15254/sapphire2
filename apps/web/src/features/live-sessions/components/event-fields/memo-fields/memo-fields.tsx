import { Field } from "@/shared/components/ui/field";
import { Textarea } from "@/shared/components/ui/textarea";

interface MemoFieldsProps {
	onTextChange: (v: string) => void;
	text: string;
}

export function MemoFields({ onTextChange, text }: MemoFieldsProps) {
	return (
		<Field htmlFor="memo-text" label="Note">
			<Textarea
				id="memo-text"
				onChange={(e) => onTextChange(e.target.value)}
				value={text}
			/>
		</Field>
	);
}
