-- Migration: 002_artifact_contribution.sql
-- Creates the missing domain table artifact_contribution defined in app/models/artifact_contribution.py.

CREATE TABLE `artifact_contribution` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `artifact_id` BIGINT UNSIGNED NOT NULL,
    `contributor_user_id` BIGINT UNSIGNED NOT NULL,
    `role_title` VARCHAR(150) NULL,
    `contribution_description` TEXT NOT NULL,
    `contribution_share_percent` DECIMAL(5, 2) NULL,
    `claim_status` ENUM('self_declared', 'peer_confirmed', 'organization_confirmed') NOT NULL DEFAULT 'self_declared',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uq_artifact_contributor` UNIQUE (`artifact_id`, `contributor_user_id`),
    CONSTRAINT `chk_contribution_share` CHECK (
        `contribution_share_percent` IS NULL OR
        (`contribution_share_percent` >= 0 AND `contribution_share_percent` <= 100)
    ),
    CONSTRAINT `fk_contribution_artifact` FOREIGN KEY (`artifact_id`)
        REFERENCES `artifact` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_contribution_user` FOREIGN KEY (`contributor_user_id`)
        REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
