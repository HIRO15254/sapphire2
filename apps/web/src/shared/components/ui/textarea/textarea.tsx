import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			className={cn(
				"border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-ring aria-invalid:border-destructive min-h-[72px] w-full min-w-0 resize-y rounded-lg border px-3 py-2.5 leading-normal text-[length:var(--m-text-body)] transition-[border-color,box-shadow] outline-none focus:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
				className
			)}
			data-slot="textarea"
			{...props}
		/>
	);
}

export { Textarea };
