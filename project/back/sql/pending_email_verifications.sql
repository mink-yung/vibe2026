-- 이메일 인증 대기(회원가입 시 users에 넣기 전 임시 저장)
CREATE TABLE IF NOT EXISTS pending_email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pending_token_hash (token_hash),
  INDEX idx_pending_expires (expires_at)
);

-- users: 이메일 인증 여부 (컬럼이 이미 있으면 ER_DUP_FIELDNAME 무시)
ALTER TABLE users
  ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1=이메일 인증 완료';

-- 기존 가입자는 인증 완료로 간주 (마이그레이션 1회)
UPDATE users SET email_verified = 1;
