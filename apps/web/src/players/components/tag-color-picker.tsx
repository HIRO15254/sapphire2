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
		<div
			aria-label="Tag color"
			className="flex flex-wrap gap-2"
			role="radiogroup"
		>
			{TAG_COLOR_NAMES.map((color) => {
				const isSelected = value === color;
				return (
					<label
						className={[
							"flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full transition-transform",
							TAG_COLORS[color].swatch,
							isSelected
								? "scale-110 ring-2 ring-white ring-offset-2 dark:ring-offset-gray-900"
								: "",
						].join(" ")}
						key={color}
					>
						<input
							aria-label={`Select ${color} color`}
							checked={isSelected}
							className="sr-only"
							name="tag-color"
							onChange={() => onChange(color)}
							type="radio"
							value={color}
						/>
						<span className="h-6 w-6 rounded-full" />
					</label>
				);
			})}
		</div>
	);
}
