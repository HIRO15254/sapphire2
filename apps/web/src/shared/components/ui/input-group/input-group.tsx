import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputGroupProps extends ComponentProps<"section"> {
	children: ReactNode;
	label: ReactNode;
}

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
