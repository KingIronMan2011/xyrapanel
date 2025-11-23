DROP TABLE `password_resets`;--> statement-breakpoint
DROP TABLE `user_impersonation_tokens`;--> statement-breakpoint
CREATE INDEX `accounts_user_id_index` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `api_keys_user_id_index` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_index` ON `audit_events` (`actor`);--> statement-breakpoint
CREATE INDEX `audit_events_action_index` ON `audit_events` (`action`);--> statement-breakpoint
CREATE INDEX `audit_events_occurred_at_index` ON `audit_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `rate_limit_last_request_index` ON `rate_limit` (`last_request`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_index` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_index` ON `sessions` (`expires`);--> statement-breakpoint
CREATE INDEX `sessions_token_index` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `users_role_index` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `verification_tokens_identifier_index` ON `verification_tokens` (`identifier`);