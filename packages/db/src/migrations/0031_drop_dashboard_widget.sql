-- dashboard_widget stored per-user, per-device widget layout + config for
-- the configurable dashboard page. The dashboard feature has been removed
-- and replaced with a fixed statistics page (SA2-54 / SA2-55).

DROP INDEX IF EXISTS `dashboard_widget_user_device_idx`;
--> statement-breakpoint
DROP TABLE `dashboard_widget`;
