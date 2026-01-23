-- =============================================================================
-- TAGGING SYSTEM MIGRATION
-- =============================================================================
-- Master Taxonomy for Skills & Domains
-- Created: 2026-01-20
-- =============================================================================

-- ============================================================================
-- 1. SKILL DOMAINS (Layer 1 - Lĩnh vực/Categories)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "skill_domains" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  wizard_mapping JSONB,
  matching_weight INT DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skill_domains_slug ON skill_domains(slug);
CREATE INDEX IF NOT EXISTS idx_skill_domains_active ON skill_domains(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. SKILLS (Layer 2 - Kỹ năng/Tech Stacks)
-- ============================================================================

CREATE TYPE skill_category AS ENUM (
  -- For Freelancers
  'FRONTEND', 'BACKEND', 'MOBILE', 'DATABASE', 'DEVOPS', 
  'DESIGN', 'TESTING', 'DATA', 'AI_ML',
  -- For Brokers  
  'BUSINESS_ANALYSIS', 'PROJECT_MANAGEMENT', 'CONSULTING', 'DOMAIN_EXPERTISE',
  -- For Staff (Audit skills)
  'AUDIT_SECURITY', 'AUDIT_CODE_QUALITY', 'AUDIT_FINANCE', 'AUDIT_LEGAL', 'AUDIT_TECHNICAL',
  'OTHER'
);

CREATE TABLE IF NOT EXISTS "skills" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID REFERENCES skill_domains(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  category skill_category DEFAULT 'OTHER',
  aliases TEXT[], -- Alternative names for search
  for_freelancer BOOLEAN DEFAULT true,
  for_broker BOOLEAN DEFAULT false,
  for_staff BOOLEAN DEFAULT false,
  matching_weight INT DEFAULT 70,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skills_slug ON skills(slug);
CREATE INDEX IF NOT EXISTS idx_skills_domain ON skills(domain_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_for_freelancer ON skills(for_freelancer) WHERE for_freelancer = true;
CREATE INDEX IF NOT EXISTS idx_skills_for_broker ON skills(for_broker) WHERE for_broker = true;
CREATE INDEX IF NOT EXISTS idx_skills_for_staff ON skills(for_staff) WHERE for_staff = true;

-- ============================================================================
-- 3. USER SKILLS (User-Skill Junction)
-- ============================================================================

CREATE TYPE skill_priority AS ENUM ('PRIMARY', 'SECONDARY');
CREATE TYPE skill_verification_status AS ENUM (
  'SELF_DECLARED', 'PORTFOLIO_LINKED', 'PROJECT_VERIFIED', 'ADMIN_VERIFIED'
);

CREATE TABLE IF NOT EXISTS "user_skills" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  priority skill_priority DEFAULT 'SECONDARY',
  verification_status skill_verification_status DEFAULT 'SELF_DECLARED',
  portfolio_url TEXT,
  completed_projects_count INT DEFAULT 0,
  last_used_at TIMESTAMP,
  proficiency_level INT CHECK (proficiency_level >= 1 AND proficiency_level <= 10),
  years_of_experience INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON user_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_priority ON user_skills(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_user_skills_verified ON user_skills(skill_id, verification_status);

-- ============================================================================
-- 4. STAFF EXPERTISE (Staff's Audit Skills)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "staff_expertise" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  expertise_level INT DEFAULT 1 CHECK (expertise_level >= 1 AND expertise_level <= 5),
  certification_name VARCHAR(255),
  certification_expiry DATE,
  disputes_handled INT DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_expertise_staff ON staff_expertise(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_expertise_skill ON staff_expertise(skill_id);
CREATE INDEX IF NOT EXISTS idx_staff_expertise_level ON staff_expertise(expertise_level);

-- ============================================================================
-- 5. DISPUTE SKILL REQUIREMENTS
-- ============================================================================

CREATE TYPE dispute_skill_source AS ENUM ('AUTO_DETECTED', 'MANUAL_TAGGED', 'ESCALATION');

CREATE TABLE IF NOT EXISTS "dispute_skill_requirements" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  source dispute_skill_source DEFAULT 'AUTO_DETECTED',
  required_level INT DEFAULT 1 CHECK (required_level >= 1 AND required_level <= 5),
  is_mandatory BOOLEAN DEFAULT true,
  added_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dispute_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_dispute_skills_dispute ON dispute_skill_requirements(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_skills_skill ON dispute_skill_requirements(skill_id);

-- ============================================================================
-- 6. SKILL MAPPING RULES (Auto-tagging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "skill_mapping_rules" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL, -- DISPUTE_CATEGORY, WIZARD_ANSWER
  entity_value VARCHAR(100) NOT NULL,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  required_level INT DEFAULT 1,
  is_mandatory BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skill_mapping_entity ON skill_mapping_rules(entity_type, entity_value);
CREATE INDEX IF NOT EXISTS idx_skill_mapping_skill ON skill_mapping_rules(skill_id);

-- ============================================================================
-- 7. SEED DATA: DOMAINS
-- ============================================================================

INSERT INTO skill_domains (name, slug, description, icon, matching_weight, sort_order) VALUES
  ('E-commerce', 'e-commerce', 'Online retail and marketplace platforms', 'shopping-cart', 30, 1),
  ('FinTech', 'fintech', 'Financial technology and payment systems', 'credit-card', 30, 2),
  ('EdTech', 'edtech', 'Educational technology and learning platforms', 'graduation-cap', 30, 3),
  ('Healthcare', 'healthcare', 'Medical and health-related systems', 'heart-pulse', 30, 4),
  ('Mobile App', 'mobile-app', 'Native and cross-platform mobile applications', 'smartphone', 30, 5),
  ('Web System', 'web-system', 'Web-based applications and portals', 'globe', 30, 6),
  ('Enterprise', 'enterprise', 'Business and enterprise solutions', 'building', 30, 7),
  ('Social Platform', 'social-platform', 'Social networking and community platforms', 'users', 30, 8),
  ('IoT/Hardware', 'iot-hardware', 'Internet of Things and hardware integration', 'cpu', 30, 9),
  ('AI/Data', 'ai-data', 'Artificial intelligence and data solutions', 'brain', 30, 10)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 8. SEED DATA: SKILLS (Freelancer Tech Stacks)
-- ============================================================================

-- Frontend Skills
INSERT INTO skills (domain_id, name, slug, category, for_freelancer, for_broker, for_staff, matching_weight, sort_order) VALUES
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'ReactJS', 'reactjs', 'FRONTEND', true, false, false, 70, 1),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Vue.js', 'vuejs', 'FRONTEND', true, false, false, 70, 2),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Angular', 'angular', 'FRONTEND', true, false, false, 70, 3),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Next.js', 'nextjs', 'FRONTEND', true, false, false, 70, 4),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'TypeScript', 'typescript', 'FRONTEND', true, false, false, 70, 5),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'HTML/CSS', 'html-css', 'FRONTEND', true, false, false, 70, 6),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'TailwindCSS', 'tailwindcss', 'FRONTEND', true, false, false, 70, 7)
ON CONFLICT (slug) DO NOTHING;

-- Backend Skills
INSERT INTO skills (domain_id, name, slug, category, for_freelancer, for_broker, for_staff, matching_weight, sort_order) VALUES
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Node.js', 'nodejs', 'BACKEND', true, false, false, 70, 10),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'NestJS', 'nestjs', 'BACKEND', true, false, false, 70, 11),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Express.js', 'expressjs', 'BACKEND', true, false, false, 70, 12),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Python/Django', 'python-django', 'BACKEND', true, false, false, 70, 13),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Python/FastAPI', 'python-fastapi', 'BACKEND', true, false, false, 70, 14),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Java/Spring', 'java-spring', 'BACKEND', true, false, false, 70, 15),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), '.NET Core', 'dotnet-core', 'BACKEND', true, false, false, 70, 16),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'PHP/Laravel', 'php-laravel', 'BACKEND', true, false, false, 70, 17),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Go/Golang', 'golang', 'BACKEND', true, false, false, 70, 18),
  ((SELECT id FROM skill_domains WHERE slug = 'web-system'), 'Ruby on Rails', 'ruby-rails', 'BACKEND', true, false, false, 70, 19)
ON CONFLICT (slug) DO NOTHING;

-- Mobile Skills
INSERT INTO skills (domain_id, name, slug, category, for_freelancer, for_broker, for_staff, matching_weight, sort_order) VALUES
  ((SELECT id FROM skill_domains WHERE slug = 'mobile-app'), 'Flutter', 'flutter', 'MOBILE', true, false, false, 70, 20),
  ((SELECT id FROM skill_domains WHERE slug = 'mobile-app'), 'React Native', 'react-native', 'MOBILE', true, false, false, 70, 21),
  ((SELECT id FROM skill_domains WHERE slug = 'mobile-app'), 'Swift/iOS', 'swift-ios', 'MOBILE', true, false, false, 70, 22),
  ((SELECT id FROM skill_domains WHERE slug = 'mobile-app'), 'Kotlin/Android', 'kotlin-android', 'MOBILE', true, false, false, 70, 23)
ON CONFLICT (slug) DO NOTHING;

-- Database Skills
INSERT INTO skills (domain_id, name, slug, category, for_freelancer, for_broker, for_staff, matching_weight, sort_order) VALUES
  (NULL, 'PostgreSQL', 'postgresql', 'DATABASE', true, false, false, 70, 30),
  (NULL, 'MySQL', 'mysql', 'DATABASE', true, false, false, 70, 31),
  (NULL, 'MongoDB', 'mongodb', 'DATABASE', true, false, false, 70, 32),
  (NULL, 'Redis', 'redis', 'DATABASE', true, false, false, 70, 33),
  (NULL, 'Elasticsearch', 'elasticsearch', 'DATABASE', true, false, false, 70, 34)
ON CONFLICT (slug) DO NOTHING;

-- DevOps Skills
INSERT INTO skills (domain_id, name, slug, category, for_freelancer, for_broker, for_staff, matching_weight, sort_order) VALUES
  (NULL, 'AWS', 'aws', 'DEVOPS', true, false, false, 70, 40),
  (NULL, 'Google Cloud', 'gcp', 'DEVOPS', true, false, false, 70, 41),
  (NULL, 'Azure', 'azure', 'DEVOPS', true, false, false, 70, 42),
  (NULL, 'Docker', 'docker', 'DEVOPS', true, false, false, 70, 43),
  (NULL, 'Kubernetes', 'kubernetes', 'DEVOPS', true, false, false, 70, 44),
  (NULL, 'CI/CD', 'cicd', 'DEVOPS', true, false, false, 70, 45)
ON CONFLICT (slug) DO NOTHING;

-- Design Skills
INSERT INTO skills (domain_id, name, slug, category, for_freelancer, for_broker, for_staff, matching_weight, sort_order) VALUES
  (NULL, 'UI/UX Design', 'ui-ux-design', 'DESIGN', true, false, false, 70, 50),
  (NULL, 'Figma', 'figma', 'DESIGN', true, false, false, 70, 51),
  (NULL, 'Adobe XD', 'adobe-xd', 'DESIGN', true, false, false, 70, 52),
  (NULL, 'Graphic Design', 'graphic-design', 'DESIGN', true, false, false, 70, 53)
ON CONFLICT (slug) DO NOTHING;

-- Testing Skills
INSERT INTO skills (domain_id, name, slug, category, for_freelancer, for_broker, for_staff, matching_weight, sort_order) VALUES
  (NULL, 'Manual Testing', 'manual-testing', 'TESTING', true, false, false, 70, 60),
  (NULL, 'Automation Testing', 'automation-testing', 'TESTING', true, false, false, 70, 61),
  (NULL, 'Performance Testing', 'performance-testing', 'TESTING', true, false, false, 70, 62)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 9. SEED DATA: BROKER SKILLS (Process & Domain Expertise)
-- ============================================================================

INSERT INTO skills (domain_id, name, slug, category, for_freelancer, for_broker, for_staff, matching_weight, sort_order) VALUES
  (NULL, 'Business Analysis', 'business-analysis', 'BUSINESS_ANALYSIS', false, true, false, 70, 70),
  (NULL, 'Requirements Gathering', 'requirements-gathering', 'BUSINESS_ANALYSIS', false, true, false, 70, 71),
  (NULL, 'Project Management', 'project-management', 'PROJECT_MANAGEMENT', false, true, false, 70, 72),
  (NULL, 'Agile/Scrum', 'agile-scrum', 'PROJECT_MANAGEMENT', false, true, false, 70, 73),
  (NULL, 'Payment Integration Expert', 'payment-integration', 'DOMAIN_EXPERTISE', false, true, false, 70, 74),
  (NULL, 'SME Digital Transformation', 'sme-digital-transformation', 'DOMAIN_EXPERTISE', false, true, false, 70, 75),
  (NULL, 'E-commerce Consulting', 'ecommerce-consulting', 'CONSULTING', false, true, false, 70, 76)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 10. SEED DATA: STAFF AUDIT SKILLS
-- ============================================================================

INSERT INTO skills (domain_id, name, slug, category, for_freelancer, for_broker, for_staff, matching_weight, sort_order) VALUES
  (NULL, 'Security Auditor', 'security-auditor', 'AUDIT_SECURITY', false, false, true, 70, 80),
  (NULL, 'Code Quality Reviewer', 'code-quality-reviewer', 'AUDIT_CODE_QUALITY', false, false, true, 70, 81),
  (NULL, 'Financial Logic Expert', 'financial-logic-expert', 'AUDIT_FINANCE', false, false, true, 70, 82),
  (NULL, 'Contract Compliance', 'contract-compliance', 'AUDIT_LEGAL', false, false, true, 70, 83),
  (NULL, 'Technical Architecture Review', 'technical-architecture', 'AUDIT_TECHNICAL', false, false, true, 70, 84),
  (NULL, 'Performance Auditor', 'performance-auditor', 'AUDIT_TECHNICAL', false, false, true, 70, 85),
  (NULL, 'Data Privacy Expert', 'data-privacy-expert', 'AUDIT_SECURITY', false, false, true, 70, 86)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 11. SEED DATA: SKILL MAPPING RULES (Dispute Category → Required Skills)
-- ============================================================================

-- FRAUD disputes → Security Auditor + Financial Logic Expert
INSERT INTO skill_mapping_rules (entity_type, entity_value, skill_id, required_level, is_mandatory, priority) VALUES
  ('DISPUTE_CATEGORY', 'FRAUD', (SELECT id FROM skills WHERE slug = 'security-auditor'), 3, true, 1),
  ('DISPUTE_CATEGORY', 'FRAUD', (SELECT id FROM skills WHERE slug = 'financial-logic-expert'), 2, true, 2)
ON CONFLICT DO NOTHING;

-- PAYMENT disputes → Financial Logic Expert
INSERT INTO skill_mapping_rules (entity_type, entity_value, skill_id, required_level, is_mandatory, priority) VALUES
  ('DISPUTE_CATEGORY', 'PAYMENT', (SELECT id FROM skills WHERE slug = 'financial-logic-expert'), 2, true, 1)
ON CONFLICT DO NOTHING;

-- QUALITY disputes → Code Quality Reviewer
INSERT INTO skill_mapping_rules (entity_type, entity_value, skill_id, required_level, is_mandatory, priority) VALUES
  ('DISPUTE_CATEGORY', 'QUALITY', (SELECT id FROM skills WHERE slug = 'code-quality-reviewer'), 2, true, 1)
ON CONFLICT DO NOTHING;

-- CONTRACT disputes → Contract Compliance
INSERT INTO skill_mapping_rules (entity_type, entity_value, skill_id, required_level, is_mandatory, priority) VALUES
  ('DISPUTE_CATEGORY', 'CONTRACT', (SELECT id FROM skills WHERE slug = 'contract-compliance'), 2, true, 1)
ON CONFLICT DO NOTHING;

COMMIT;
