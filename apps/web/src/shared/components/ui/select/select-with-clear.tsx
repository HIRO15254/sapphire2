import { IconX } from "@tabler/icons-react";
import type { Select as SelectPrimitive } from "radix-ui";
import type * as React from "react";
import { Select } from "./select";

interface SelectWithClearProps
	extends Omit<
		React.ComponentProps<typeof SelectPrimitive.Root>,
		"onValueChange" | "value"
	> {
	onValueChange?: (value: string | undefined) => void;
	value?: string;
}

export function SelectWithClear({
	children,
	onValueChange,
	value,
	...props
}: SelectWithClearProps) {
	const canClear = value !== undefined && value !== "" && !props.disabled;
	// Radix Select does not reset its internal state when `value` switches from a
	// defined string to `undefined` while controlled. Remounting via `key` forces
	// it back to the empty (placeholder) state.
	const selectKey = value ?? "__unset__";
	return (
		<div className="relative">
			<Select
				key={selectKey}
				onValueChange={onValueChange}
				value={value}
				{...props}
			>
				{children}
			</Select>
			{canClear && onValueChange ? (
				<button
					aria-label="Clear selection"
					className="absolute top-1/2 right-8 z-10 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
					onClick={() => onValueChange(undefined)}
					type="button"
				>
					<IconX size={14} />
				</button>
			) : null}
		</div>
	);
}
