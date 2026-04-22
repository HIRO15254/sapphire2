import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout } from "react-grid-layout";
import { useEditMode } from "@/features/dashboard/components/edit-mode-toggle";
import { useCurrentDevice } from "@/features/dashboard/hooks/use-current-device";
import {
	type DashboardWidget,
	useDashboardWidgets,
	type WidgetType,
} from "@/features/dashboard/hooks/use-dashboard-widgets";
import {
	type LayoutItem,
	useLayoutSync,
} from "@/features/dashboard/hooks/use-layout-sync";

function layoutsToItems(layout: Layout[]): LayoutItem[] {
	return layout.map((l) => ({
		id: l.i,
		x: l.x,
		y: l.y,
		w: l.w,
		h: l.h,
	}));
}

function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
	const ref = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) {
			return;
		}
		const update = () => setWidth(el.getBoundingClientRect().width);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return [ref, width];
}

export function useDashboardPage() {
	const device = useCurrentDevice();
	const {
		widgets,
		isLoading,
		error,
		createWidget,
		updateWidget,
		deleteWidget,
	} = useDashboardWidgets(device);
	const { isEditing, setEditing, toggle } = useEditMode();
	const { enqueue, flush, discard, hasPendingChanges } = useLayoutSync(device);
	const [containerRef, containerWidth] = useContainerWidth();
	const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(
		null
	);
	const [deletingWidget, setDeletingWidget] = useState<DashboardWidget | null>(
		null
	);

	const blocker = useBlocker({
		shouldBlockFn: () => hasPendingChanges,
		enableBeforeUnload: () => hasPendingChanges,
		withResolver: true,
	});

	const handleLayoutChange = useCallback(
		(layout: Layout[]) => {
			enqueue(layoutsToItems(layout));
		},
		[enqueue]
	);

	const handleDoneClick = useCallback(async () => {
		if (isEditing) {
			await flush();
			setEditing(false);
		} else {
			toggle();
		}
	}, [isEditing, flush, setEditing, toggle]);

	const handleAdd = useCallback(
		async (type: WidgetType) => {
			await flush();
			await createWidget({ type });
		},
		[createWidget, flush]
	);

	const handleEditSave = useCallback(
		async (nextConfig: Record<string, unknown>) => {
			if (!editingWidget) {
				return;
			}
			await updateWidget({ id: editingWidget.id, config: nextConfig });
		},
		[editingWidget, updateWidget]
	);

	const handleDelete = useCallback(async () => {
		if (!deletingWidget) {
			return;
		}
		await flush();
		await deleteWidget(deletingWidget.id);
		setDeletingWidget(null);
	}, [deletingWidget, deleteWidget, flush]);

	const handleBlockerSave = useCallback(async () => {
		if (blocker.status !== "blocked") {
			return;
		}
		await flush();
		blocker.proceed();
	}, [blocker, flush]);

	const handleBlockerDiscard = useCallback(() => {
		if (blocker.status !== "blocked") {
			return;
		}
		discard();
		blocker.proceed();
	}, [blocker, discard]);

	const handleBlockerCancel = () => {
		if (blocker.status === "blocked") {
			blocker.reset();
		}
	};

	const handleDeletingWidgetDialogChange = (open: boolean) => {
		if (!open) {
			setDeletingWidget(null);
		}
	};

	const handleEditingWidgetDialogChange = (open: boolean) => {
		if (!open) {
			setEditingWidget(null);
		}
	};

	return {
		blocker,
		containerRef,
		containerWidth,
		deletingWidget,
		device,
		editingWidget,
		error,
		handleAdd,
		handleBlockerCancel,
		handleBlockerDiscard,
		handleBlockerSave,
		handleDelete,
		handleDeletingWidgetDialogChange,
		handleDoneClick,
		handleEditingWidgetDialogChange,
		handleEditSave,
		handleLayoutChange,
		isEditing,
		isLoading,
		setDeletingWidget,
		setEditingWidget,
		widgets,
	};
}
