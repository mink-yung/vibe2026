-- 이미 age, university, hobby, specialty 만 추가한 DB용: 나머지 상세 컬럼만 추가 (한 번만 실행)
ALTER TABLE users
  ADD COLUMN major VARCHAR(200) NULL COMMENT '전공',
  ADD COLUMN desired_position VARCHAR(200) NULL COMMENT '희망 직무',
  ADD COLUMN career_level VARCHAR(100) NULL COMMENT '경력 수준',
  ADD COLUMN skills TEXT NULL COMMENT '기술/역량',
  ADD COLUMN certifications TEXT NULL COMMENT '자격증',
  ADD COLUMN projects TEXT NULL COMMENT '프로젝트 경험',
  ADD COLUMN experience TEXT NULL COMMENT '경력/활동 경험',
  ADD COLUMN resume_text TEXT NULL COMMENT '이력서 내용',
  ADD COLUMN portfolio_url VARCHAR(500) NULL COMMENT '포트폴리오 링크',
  ADD COLUMN github_url VARCHAR(500) NULL COMMENT '깃허브 링크';
