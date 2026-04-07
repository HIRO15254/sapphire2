import type * as React from "react";
import { cn } from "@/lib/utils";

function DialogActionRow({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end",
				className
			)}
			{...props}
		/>
	);
}

export { DialogActionRow };
