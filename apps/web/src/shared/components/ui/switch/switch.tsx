import type * as React from "react";
import { cn } from "@/lib/utils";
import { useCheckedChange } from "@/shared/hooks/use-checked-change";

interface SwitchProps
	extends Omit<React.ComponentProps<"input">, "checked" | "size" | "type"> {
	checked: boolean;
	label?: React.ReactNode;
	onCheckedChange: (checked: boolean) => void;
	size?: "default" | "xl";
}

function Switch({
	checked,
	className,
	disabled,
	label,
	onCheckedChange,
	size = "default",
	...props
}: SwitchProps) {
	const onChange = useCheckedChange(onCheckedChange);
	return (
		<label
			className={cn(
				"text-foreground relative inline-flex cursor-pointer items-center gap-2 text-sm select-none",
				size === "xl" &&
					"min-h-[var(--m-control)] gap-2.5 text-[length:var(--m-text-body)]",
				disabled && "cursor-not-allowed opacity-50",
				className
			)}
			data-slot="switch"
		>
			<input
				aria-checked={checked}
				checked={checked}
				className="peer absolute size-0 opacity-0"
				disabled={disabled}
				onChange={onChange}
				role="switch"
				type="checkbox"
				{...props}
			/>
			<span
				aria-hidden
				className={cn(
					"bg-input peer-checked:bg-primary after:bg-switch-thumb relative flex-none rounded-full transition-[background-color] peer-focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] after:absolute after:top-0.5 after:left-0.5 after:rounded-full after:shadow-[var(--shadow-sm)] after:transition-transform",
					size === "xl"
						? "h-6 w-10 after:size-5 peer-checked:after:translate-x-4"
						: "h-4 w-7 after:size-3 peer-checked:after:translate-x-3"
				)}
			/>
			{label ? <span>{label}</span> : null}
		</label>
	);
}

export { Switch };
