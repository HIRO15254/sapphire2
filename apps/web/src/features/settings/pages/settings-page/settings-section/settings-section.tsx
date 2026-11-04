import type { ReactNode } from "react";

export function SettingsSection({
	children,
	heading,
	note,
}: {
	children: ReactNode;
	heading: string;
	note?: ReactNode;
}) {
	return (
		<section aria-label={heading} className="flex flex-col gap-1.5">
			<h2 className="m-0 px-1 font-semibold text-[length:var(--m-text-footnote)] text-muted-foreground uppercase tracking-[var(--tracking-caps)]">
				{heading}
			</h2>
			{children}
			{note ? <SettingsNote>{note}</SettingsNote> : null}
		</section>
	);
}

export function SettingsNote({ children }: { children: ReactNode }) {
	return (
		<p className="m-0 px-1 text-[length:var(--m-text-footnote)] text-muted-foreground leading-normal">
			{children}
		</p>
	);
}
