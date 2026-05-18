-- 비밀번호 재설정 토큰 (원문 저장 없음, sha256 해시만 저장)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_prt_user_id (user_id),
  INDEX idx_prt_token_hash (token_hash),
  INDEX idx_prt_expires (expires_at)
);
