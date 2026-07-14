import { useEffect } from "react";
import { toast } from "sonner";
import { registerSW } from "@/shared/lib/pwa-register";

export function usePwaUpdate() {
	useEffect(() => {
		const updateSW = registerSW({
			onNeedRefresh() {
				toast.info("An update is available", {
					action: { label: "Reload", onClick: () => updateSW(true) },
				});
			},
		});
	}, []);
}
