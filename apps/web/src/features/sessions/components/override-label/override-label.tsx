import type { ReactNode } from "react";
import { Badge } from "@/shared/components/ui/badge";

interface OverrideLabelProps {
	label: string;
	overridden?: ReadonlySet<string>;
	overrideKey?: string;
}

export function OverrideLabel({
	label,
	overridden,
	overrideKey,
}: OverrideLabelProps): ReactNode {
	if (!overridden?.has(overrideKey ?? label)) {
		return label;
	}
	return (
		<span className="flex items-center gap-1.5">
			{label}
			<Badge className="px-1 py-0 text-[10px]" variant="outline">
				Modified
			</Badge>
		</span>
	);
}
