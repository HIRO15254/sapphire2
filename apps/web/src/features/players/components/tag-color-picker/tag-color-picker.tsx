import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import {
	TAG_COLOR_NAMES,
	TAG_COLORS,
	type TagColor,
} from "@/features/players/constants/player-tag-colors";
import { cn } from "@/lib/utils";
import { RadioGroup } from "@/shared/components/ui/radio-group";

interface TagColorPickerProps {
	onChange: (color: TagColor) => void;
	value: TagColor;
}

export function TagColorPicker({ value, onChange }: TagColorPickerProps) {
	return (
		<RadioGroup
			aria-label="Tag color"
			className="flex flex-wrap gap-2"
			onValueChange={(next) => onChange(next as TagColor)}
			value={value}
		>
			{TAG_COLOR_NAMES.map((color) => (
				<RadioGroupPrimitive.Item
					aria-label={`Select ${color} color`}
					className={cn(
						"block h-7 w-7 cursor-pointer rounded-full outline-none transition-transform",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						TAG_COLORS[color].swatch,
						value === color &&
							"scale-110 ring-2 ring-white ring-offset-2 dark:ring-offset-gray-900"
					)}
					key={color}
					value={color}
				/>
			))}
		</RadioGroup>
	);
}
