import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
	"border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-ring aria-invalid:border-destructive w-full min-w-0 border px-2.5 transition-[border-color,box-shadow] outline-none focus:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:focus:shadow-[0_0_0_1px_var(--destructive)]",
	{
		defaultVariants: {
			size: "default",
		},
		variants: {
			size: {
				default: "h-[var(--control-md)] rounded-md text-sm",
				xl: "h-[var(--m-control)] rounded-lg text-[length:var(--m-text-body)]",
			},
		},
	}
);

function Input({
	className,
	size = "default",
	type,
	...props
}: Omit<React.ComponentProps<"input">, "size"> &
	VariantProps<typeof inputVariants>) {
	return (
		<input
			className={cn(inputVariants({ className, size }))}
			data-size={size}
			data-slot="input"
			type={type}
			{...props}
		/>
	);
}

export { Input };
