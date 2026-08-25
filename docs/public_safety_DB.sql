-- --------------------------------------------------------
-- 호스트:                          43.202.197.59
-- 서버 버전:                        10.11.14-MariaDB-0ubuntu0.24.04.1 - Ubuntu 24.04
-- 서버 OS:                        debian-linux-gnu
-- HeidiSQL 버전:                  12.17.0.7270
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- public_safety_map 데이터베이스 구조 내보내기
CREATE DATABASE IF NOT EXISTS `public_safety_map` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `public_safety_map`;

-- 테이블 public_safety_map.city_events 구조 내보내기
CREATE TABLE IF NOT EXISTS `city_events` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `type` varchar(20) DEFAULT NULL,
  `title` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  `lng` decimal(11,8) DEFAULT NULL,
  `img_url` varchar(255) DEFAULT NULL COMMENT '첨부 사진 URL (선택)',
  `start_at` datetime DEFAULT NULL,
  `end_at` datetime DEFAULT NULL,
  `created_by` bigint(20) DEFAULT NULL COMMENT '등록한 관리자, 외부 API 자동수집 시 NULL 가능',
  `created_at` datetime DEFAULT NULL,
  `is_active` enum('Y','N') DEFAULT 'Y' COMMENT '소프트 삭제 여부',
  PRIMARY KEY (`id`),
  KEY `FK_city_events_user` (`created_by`),
  CONSTRAINT `FK_city_events_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=479 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='실시간 도시정보(행사/인파밀집/교통통제). grid 테이블과 독립적으로 좌표만으로 관리';

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 이벤트 public_safety_map.cleanup_refresh_tokens 구조 내보내기
DELIMITER //
CREATE EVENT `cleanup_refresh_tokens` ON SCHEDULE EVERY 1 DAY STARTS '2026-08-13 10:26:05' ON COMPLETION NOT PRESERVE ENABLE DO DELETE FROM refresh_token
    WHERE
        expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
        OR revoked_at < DATE_SUB(NOW(), INTERVAL 7 DAY)//
DELIMITER ;

-- 테이블 public_safety_map.data_version 구조 내보내기
CREATE TABLE IF NOT EXISTS `data_version` (
  `data_type` varchar(50) NOT NULL,
  `version` varchar(20) NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`data_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 테이블 public_safety_map.device_tokens 구조 내보내기
CREATE TABLE IF NOT EXISTS `device_tokens` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) DEFAULT NULL COMMENT '비회원이면 NULL',
  `fcm_token` varchar(255) NOT NULL,
  `device_type` varchar(20) DEFAULT 'web',
  `is_active` enum('Y','N') DEFAULT 'Y',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fcm_token` (`fcm_token`),
  KEY `FK_device_tokens_user` (`user_id`),
  CONSTRAINT `FK_device_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='긴급 위험 알림(FN-02-02) 발송 대상 기기 목록';

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 테이블 public_safety_map.feedback 구조 내보내기
CREATE TABLE IF NOT EXISTS `feedback` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) DEFAULT NULL,
  `grid_id` bigint(20) DEFAULT NULL,
  `safety_feeling` varchar(20) DEFAULT '보통',
  `comment` text DEFAULT NULL,
  `img_url` varchar(255) DEFAULT NULL COMMENT '첨부 사진 URL (선택)',
  `is_active` enum('Y','N') DEFAULT 'Y' COMMENT '소프트 삭제 여부',
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_feedback_user` (`user_id`),
  KEY `FK_feedback_grid` (`grid_id`),
  CONSTRAINT `FK_feedback_grid` FOREIGN KEY (`grid_id`) REFERENCES `grid` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_feedback_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=117 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 테이블 public_safety_map.feedback_tag 구조 내보내기
CREATE TABLE IF NOT EXISTS `feedback_tag` (
  `feedback_id` bigint(20) NOT NULL,
  `tag_id` bigint(20) NOT NULL,
  PRIMARY KEY (`feedback_id`,`tag_id`),
  KEY `FK_feedback_tag_feedback` (`feedback_id`),
  KEY `FK_feedback_tag_tag` (`tag_id`),
  CONSTRAINT `FK_feedback_tag_feedback` FOREIGN KEY (`feedback_id`) REFERENCES `feedback` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_feedback_tag_tag` FOREIGN KEY (`tag_id`) REFERENCES `tag` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 테이블 public_safety_map.grid 구조 내보내기
CREATE TABLE IF NOT EXISTS `grid` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `grid_row` int(11) DEFAULT NULL COMMENT '원점(33.0,124.5) 기준 행 인덱스',
  `grid_col` int(11) DEFAULT NULL COMMENT '원점(33.0,124.5) 기준 열 인덱스',
  `lat` decimal(10,8) DEFAULT NULL,
  `lng` decimal(11,8) DEFAULT NULL,
  `infra_count` int(11) DEFAULT NULL,
  `safety_grade` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_grid_row_col` (`grid_row`,`grid_col`)
) ENGINE=InnoDB AUTO_INCREMENT=68010 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 테이블 public_safety_map.infrastructures 구조 내보내기
CREATE TABLE IF NOT EXISTS `infrastructures` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `grid_id` bigint(20) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `address` varchar(50) DEFAULT NULL,
  `lng` decimal(11,8) DEFAULT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_infrastructures_grid` (`grid_id`),
  CONSTRAINT `FK_infrastructures_grid` FOREIGN KEY (`grid_id`) REFERENCES `grid` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=555416 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 테이블 public_safety_map.refresh_token 구조 내보내기
CREATE TABLE IF NOT EXISTS `refresh_token` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `user_id` bigint(20) NOT NULL COMMENT '	FK → user.id',
  `token_hash` varchar(255) NOT NULL COMMENT '	refresh token의 SHA-256 해시값 (원본 토큰 아님)',
  `expires_at` datetime NOT NULL COMMENT '이 토큰 자체의 만료 시각',
  `revoked_at` datetime DEFAULT NULL COMMENT '폐기 시각 (로그아웃/로테이션/탈취탐지 시 채워짐). NULL이면 아직 유효',
  `created_at` datetime DEFAULT NULL COMMENT '발급 시각',
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `FK_refresh_token_user` (`user_id`),
  CONSTRAINT `FK_refresh_token_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=247 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='유저의 refresh_token 정보를 저장하는 테이블';

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 테이블 public_safety_map.report 구조 내보내기
CREATE TABLE IF NOT EXISTS `report` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) DEFAULT NULL,
  `grid_id` bigint(20) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  `lng` decimal(11,8) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `img_url` varchar(255) DEFAULT NULL COMMENT '첨부 사진 URL (선택)',
  `is_active` enum('Y','N') DEFAULT 'Y',
  `created_at` datetime DEFAULT NULL COMMENT '등록일시',
  `expire_at` datetime DEFAULT NULL COMMENT '삭제일시',
  PRIMARY KEY (`id`),
  KEY `FK_report_grid` (`grid_id`),
  KEY `FK_report_user` (`user_id`),
  CONSTRAINT `FK_report_grid` FOREIGN KEY (`grid_id`) REFERENCES `grid` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_report_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10188 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='유저(관리자 포함)가 신고/등록한 지도에 나타나지 않는 긴급 사건들. 관리자 등록 여부는 user.role 조인으로 판별';

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 테이블 public_safety_map.tag 구조 내보내기
CREATE TABLE IF NOT EXISTS `tag` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.

-- 이벤트 public_safety_map.update_expired_reports 구조 내보내기
DELIMITER //
CREATE EVENT `update_expired_reports` ON SCHEDULE EVERY 1 DAY STARTS '2026-08-13 16:23:16' ON COMPLETION NOT PRESERVE ENABLE DO UPDATE report
    SET is_active = 'N'
    WHERE expire_at < NOW()
      AND is_active = 'Y'//
DELIMITER ;

-- 테이블 public_safety_map.user 구조 내보내기
CREATE TABLE IF NOT EXISTS `user` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `password_hash` varchar(255) DEFAULT NULL COMMENT 'bcrypt 해시값 저장',
  `email` varchar(50) NOT NULL,
  `nickname` varchar(50) DEFAULT NULL,
  `role` enum('USER','ADMIN') DEFAULT 'USER',
  `created_at` datetime DEFAULT NULL,
  `is_active` enum('Y','N') DEFAULT 'Y',
  `failed_login_count` int(11) NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `active_session_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 내보낼 데이터가 선택되어 있지 않습니다.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
