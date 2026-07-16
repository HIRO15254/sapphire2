UPDATE `currency_transaction`
SET `transaction_type_id` = (
	SELECT `keeper`.`id`
	FROM `transaction_type` AS `duplicate`
	INNER JOIN `transaction_type` AS `keeper`
		ON `keeper`.`user_id` = `duplicate`.`user_id`
		AND `keeper`.`name` = 'Session Result'
	WHERE `duplicate`.`id` = `currency_transaction`.`transaction_type_id`
	ORDER BY `keeper`.`created_at` ASC, `keeper`.`id` ASC
	LIMIT 1
)
WHERE `transaction_type_id` IN (
	SELECT `duplicate`.`id`
	FROM `transaction_type` AS `duplicate`
	WHERE `duplicate`.`name` = 'Session Result'
		AND `duplicate`.`id` <> (
			SELECT `keeper`.`id`
			FROM `transaction_type` AS `keeper`
			WHERE `keeper`.`user_id` = `duplicate`.`user_id`
				AND `keeper`.`name` = 'Session Result'
			ORDER BY `keeper`.`created_at` ASC, `keeper`.`id` ASC
			LIMIT 1
		)
);
--> statement-breakpoint
DELETE FROM `transaction_type`
WHERE `name` = 'Session Result'
	AND `id` <> (
		SELECT `keeper`.`id`
		FROM `transaction_type` AS `keeper`
		WHERE `keeper`.`user_id` = `transaction_type`.`user_id`
			AND `keeper`.`name` = 'Session Result'
		ORDER BY `keeper`.`created_at` ASC, `keeper`.`id` ASC
		LIMIT 1
	);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactionType_sessionResultPerUser_idx` ON `transaction_type` (`user_id`) WHERE "transaction_type"."name" = 'Session Result';
