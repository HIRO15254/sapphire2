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
			<h2 className="text-muted-foreground m-0 px-1 font-semibold tracking-[var(--tracking-caps)] text-[length:var(--m-text-footnote)] uppercase">
				{heading}
			</h2>
			{children}
			{note ? <SettingsNote>{note}</SettingsNote> : null}
		</section>
	);
}

export function SettingsNote({ children }: { children: ReactNode }) {
	return (
		<p className="text-muted-foreground m-0 px-1 leading-normal text-[length:var(--m-text-footnote)]">
			{children}
		</p>
	);
}
