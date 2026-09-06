import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { FormSheet } from "@/shared/components/form-sheet";
import { CRYST_SCOPE_CLASS } from "../cryst-scope";

export function CrystFormSheet({
	className,
	...props
}: ComponentProps<typeof FormSheet>) {
	return <FormSheet {...props} className={cn(CRYST_SCOPE_CLASS, className)} />;
}
