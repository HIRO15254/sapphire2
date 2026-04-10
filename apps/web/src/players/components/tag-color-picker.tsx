import {
	TAG_COLOR_NAMES,
	TAG_COLORS,
	type TagColor,
} from "@/players/constants/player-tag-colors";

interface TagColorPickerProps {
	onChange: (color: TagColor) => void;
	value: TagColor;
}

export function TagColorPicker({ value, onChange }: TagColorPickerProps) {
	return (
		<div aria-label="Tag color" className="flex flex-wrap" role="radiogroup">
			{TAG_COLOR_NAMES.map((color) => (
				<label
					className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center"
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
					<span
						className={`h-6 w-6 rounded-full transition-transform ${TAG_COLORS[color].swatch}${value === color ? "scale-110 ring-2 ring-white ring-offset-2 dark:ring-offset-gray-900" : ""}`}
					/>
				</label>
			))}
		</div>
	);
}
