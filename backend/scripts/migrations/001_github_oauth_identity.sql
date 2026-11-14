-- Manual MySQL 8 migration. Review and back up before execution.
-- Run once against the explicitly selected schema, during a maintenance window.
-- MySQL DDL implicitly commits: these statements are NOT one atomic transaction.
-- No IF NOT EXISTS: unexpected existing objects must be reviewed, not silently accepted.

CREATE TABLE `user_oauth_identity` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `provider` ENUM('github') NOT NULL,
    `provider_user_id` VARCHAR(255) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uq_oauth_provider_identity` UNIQUE (`provider`, `provider_user_id`),
    CONSTRAINT `uq_oauth_user_provider` UNIQUE (`user_id`, `provider`),
    CONSTRAINT `fk_oauth_identity_user` FOREIGN KEY (`user_id`)
        REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE `user` MODIFY COLUMN `password_hash` VARCHAR(255) NULL;
