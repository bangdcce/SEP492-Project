-- =========================================================
-- SEED USER SKILLS FOR TEST ACCOUNTS
-- Freelancer: 12ebc462-d122-4a3a-914a-1a7f08064090
-- Broker:     261430db-300b-4481-b0c4-dc032c656057
-- =========================================================

-- Clear existing user_skills for these test users to avoid duplicates
DELETE FROM user_skills WHERE "userId" IN (
  '12ebc462-d122-4a3a-914a-1a7f08064090',
  '261430db-300b-4481-b0c4-dc032c656057'
);

-- ==========================================
-- FREELANCER SKILLS (broad coverage for matching tests)
-- ==========================================

-- Web Dev skills
INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'PRIMARY', 'PROJECT_VERIFIED', 8, 5
FROM skills WHERE slug = 'reactjs';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'PRIMARY', 'PROJECT_VERIFIED', 6, 4
FROM skills WHERE slug = 'nodejs';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'SELF_DECLARED', 2, 2
FROM skills WHERE slug = 'angular';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'SELF_DECLARED', 1, 1
FROM skills WHERE slug = 'python-django';

-- Mobile
INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'PRIMARY', 'PROJECT_VERIFIED', 4, 3
FROM skills WHERE slug = 'react-native';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'SELF_DECLARED', 1, 1
FROM skills WHERE slug = 'flutter';

-- DevOps
INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'PORTFOLIO_LINKED', 3, 2
FROM skills WHERE slug = 'aws';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'PORTFOLIO_LINKED', 3, 2
FROM skills WHERE slug = 'docker';

-- Finance & Fintech (for testing domain matching)
INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'SELF_DECLARED', 2, 2
FROM skills WHERE slug = 'banking-systems';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'SELF_DECLARED', 1, 1
FROM skills WHERE slug = 'payment-gateways';

-- E-Commerce
INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'SELF_DECLARED', 2, 2
FROM skills WHERE slug = 'shopify-development';

-- AI
INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'SELF_DECLARED', 1, 1
FROM skills WHERE slug = 'openai-gpt-integration';

-- QA
INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '12ebc462-d122-4a3a-914a-1a7f08064090', id, 'SECONDARY', 'SELF_DECLARED', 2, 2
FROM skills WHERE slug = 'automation-testing';

-- ==========================================
-- BROKER SKILLS (management + domain expertise)
-- ==========================================

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '261430db-300b-4481-b0c4-dc032c656057', id, 'PRIMARY', 'PROJECT_VERIFIED', 12, 4
FROM skills WHERE slug = 'project-management';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '261430db-300b-4481-b0c4-dc032c656057', id, 'PRIMARY', 'PROJECT_VERIFIED', 10, 3
FROM skills WHERE slug = 'client-communication';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '261430db-300b-4481-b0c4-dc032c656057', id, 'SECONDARY', 'SELF_DECLARED', 5, 3
FROM skills WHERE slug = 'requirement-analysis';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '261430db-300b-4481-b0c4-dc032c656057', id, 'SECONDARY', 'SELF_DECLARED', 8, 3
FROM skills WHERE slug = 'team-coordination';

INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '261430db-300b-4481-b0c4-dc032c656057', id, 'SECONDARY', 'SELF_DECLARED', 4, 2
FROM skills WHERE slug = 'contract-negotiation';

-- Broker also has KYC/AML domain knowledge (for fintech matching tests)
INSERT INTO user_skills ("userId", "skillId", "priority", "verificationStatus", "completedProjectsCount", "yearsOfExperience")
SELECT '261430db-300b-4481-b0c4-dc032c656057', id, 'SECONDARY', 'SELF_DECLARED', 3, 2
FROM skills WHERE slug = 'kyc-aml-compliance';
