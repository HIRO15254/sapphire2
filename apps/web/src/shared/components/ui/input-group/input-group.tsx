import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputGroupProps extends ComponentProps<"section"> {
	children: ReactNode;
	label: ReactNode;
}

/**
 * A labeled section that groups related form controls under a heading.
 * Unlike {@link Field} (one label per single input), `InputGroup` frames a
 * cluster of fields — used to break a long single-screen form into scannable
 * sections without a stepper or tabs, so every control stays mounted for a
 * single submit.
 */
export function InputGroup({
	children,
	className,
	label,
	...props
}: InputGroupProps) {
	return (
		<section className={cn("flex flex-col gap-3", className)} {...props}>
			<p className="t-label text-muted-foreground">{label}</p>
			<div className="flex flex-col gap-3">{children}</div>
		</section>
	);
}
