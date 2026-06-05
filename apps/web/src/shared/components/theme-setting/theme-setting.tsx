import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { RadioGroup } from "@/shared/components/ui/radio-group";
import { useThemeSetting } from "./use-theme-setting";

export function ThemeSetting() {
	const { options, onValueChange, value } = useThemeSetting();

	return (
		<RadioGroup
			aria-label="Theme"
			className="grid grid-cols-3 gap-2"
			onValueChange={onValueChange}
			value={value}
		>
			{options.map(({ value: optionValue, label, icon: Icon }) => (
				<RadioGroupPrimitive.Item
					aria-label={label}
					className={cn(
						"flex cursor-pointer flex-col items-center gap-2 rounded-md border border-input bg-card px-3 py-4 font-medium text-sm outline-none transition-colors",
						"hover:bg-accent hover:text-accent-foreground",
						"focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
						"disabled:cursor-not-allowed disabled:opacity-50",
						"data-[state=checked]:border-primary data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
					)}
					key={optionValue}
					value={optionValue}
				>
					<Icon size={20} />
					{label}
				</RadioGroupPrimitive.Item>
			))}
		</RadioGroup>
	);
}
