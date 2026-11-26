import { IconCheck } from "@tabler/icons-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { useCheckedChange } from "@/shared/hooks/use-checked-change";

interface CheckboxProps
	extends Omit<React.ComponentProps<"input">, "checked" | "size" | "type"> {
	checked: boolean;
	label?: React.ReactNode;
	onCheckedChange: (checked: boolean) => void;
	size?: "default" | "xl";
}

function Checkbox({
	checked,
	className,
	disabled,
	label,
	onCheckedChange,
	size = "default",
	...props
}: CheckboxProps) {
	const onChange = useCheckedChange(onCheckedChange);
	return (
		<label
			className={cn(
				"text-foreground relative inline-flex min-w-0 cursor-pointer items-center gap-2 text-sm select-none",
				size === "xl" &&
					"min-h-[var(--m-control)] gap-2.5 text-[length:var(--m-text-body)]",
				disabled && "cursor-not-allowed opacity-50",
				className
			)}
			data-slot="checkbox"
		>
			<input
				checked={checked}
				className="peer absolute size-0 opacity-0"
				disabled={disabled}
				onChange={onChange}
				type="checkbox"
				{...props}
			/>
			<span
				aria-hidden
				className={cn(
					"border-input bg-card peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground inline-flex flex-none items-center justify-center border text-transparent transition-[background-color,border-color] peer-focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]",
					size === "xl" ? "size-5 rounded-md" : "size-4 rounded-sm"
				)}
			>
				<IconCheck className={size === "xl" ? "size-3.5" : "size-3"} />
			</span>
			{label ? <span className="min-w-0 truncate">{label}</span> : null}
		</label>
	);
}

export { Checkbox };
