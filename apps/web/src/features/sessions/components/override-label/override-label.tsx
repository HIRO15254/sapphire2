import type { ReactNode } from "react";
import { Badge } from "@/shared/components/ui/badge";

interface OverrideLabelProps {
	label: string;
	/** The set of field labels that diverge from the picked master. */
	overridden?: ReadonlySet<string>;
	/**
	 * Stable membership key when the displayed label is dynamic (e.g.
	 * variant-aware blind labels). Defaults to `label`.
	 */
	overrideKey?: string;
}

/**
 * Renders a field label, appending a small "Modified" badge when the
 * label is in the override set. Used by the session wizard's Rules step
 * to flag, inline at each label, the fields whose value no longer
 * matches the master ring game / tournament.
 */
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
