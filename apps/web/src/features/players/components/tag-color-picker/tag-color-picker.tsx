import {
	TAG_COLOR_NAMES,
	TAG_COLORS,
	type TagColor,
} from "@/features/players/constants/player-tag-colors";
import { cn } from "@/lib/utils";

interface TagColorPickerProps {
	onChange: (color: TagColor) => void;
	value: TagColor;
}

export function TagColorPicker({ value, onChange }: TagColorPickerProps) {
	return (
		<div
			aria-label="Tag color"
			className="flex flex-wrap gap-2"
			role="radiogroup"
		>
			{TAG_COLOR_NAMES.map((color) => (
				<label
					className={cn(
						"block h-7 w-7 cursor-pointer rounded-full transition-transform",
						TAG_COLORS[color].swatch,
						value === color &&
							"scale-110 ring-2 ring-white ring-offset-2 dark:ring-offset-gray-900"
					)}
					key={color}
				>
					<input
						aria-label={`Select ${color} color`}
						checked={value === color}
						className="sr-only"
						name="tag-color"
						onChange={() => onChange(color)}
						type="radio"
						value={color}
					/>
				</label>
			))}
		</div>
	);
}
