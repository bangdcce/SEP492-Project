-- =========================================================
-- ADD MORE BROKER-ELIGIBLE SKILLS (run once)
-- These are new skills not in the original seed
-- =========================================================

-- Get domain IDs
DO $$
DECLARE
  d_ui_ux UUID;
  d_fintech UUID;
  d_ecommerce UUID;
  d_healthcare UUID;
  d_devops UUID;
  d_ai UUID;
  d_mobile UUID;
  d_blockchain UUID;
BEGIN
  SELECT id INTO d_ui_ux FROM skill_domains WHERE slug = 'ui-ux-design';
  SELECT id INTO d_fintech FROM skill_domains WHERE slug = 'finance-fintech';
  SELECT id INTO d_ecommerce FROM skill_domains WHERE slug = 'ecommerce-retail';
  SELECT id INTO d_healthcare FROM skill_domains WHERE slug = 'healthcare';
  SELECT id INTO d_devops FROM skill_domains WHERE slug = 'devops-cloud';
  SELECT id INTO d_ai FROM skill_domains WHERE slug = 'data-science-ai';
  SELECT id INTO d_mobile FROM skill_domains WHERE slug = 'mobile-development';
  SELECT id INTO d_blockchain FROM skill_domains WHERE slug = 'blockchain';

  -- General Broker Skills
  INSERT INTO skills (name, slug, category, "domainId", "forFreelancer", "forBroker", "isActive", "sortOrder")
  VALUES
    ('Agile / Scrum', 'agile-scrum', 'PROJECT_MANAGEMENT', NULL, false, true, true, 100),
    ('Stakeholder Management', 'stakeholder-management', 'BUSINESS_ANALYSIS', NULL, false, true, true, 101),
    ('Risk Assessment', 'risk-assessment', 'CONSULTING', NULL, false, true, true, 102),
    ('Budget Planning', 'budget-planning', 'CONSULTING', NULL, false, true, true, 103),
    ('Vendor Management', 'vendor-management', 'PROJECT_MANAGEMENT', NULL, false, true, true, 104),
    ('Quality Assurance Oversight', 'qa-oversight', 'PROJECT_MANAGEMENT', NULL, false, true, true, 105),
    ('Technical Consulting', 'technical-consulting', 'CONSULTING', NULL, false, true, true, 106),
    ('Product Strategy', 'product-strategy', 'BUSINESS_ANALYSIS', NULL, false, true, true, 107)
  ON CONFLICT (slug) DO NOTHING;

  -- Domain-specific Broker Skills
  INSERT INTO skills (name, slug, category, "domainId", "forFreelancer", "forBroker", "isActive", "sortOrder")
  VALUES
    ('UX Strategy', 'ux-strategy', 'CONSULTING', d_ui_ux, false, true, true, 108),
    ('Fintech Consulting', 'fintech-consulting', 'DOMAIN_EXPERTISE', d_fintech, false, true, true, 109),
    ('E-Commerce Strategy', 'ecommerce-strategy', 'DOMAIN_EXPERTISE', d_ecommerce, false, true, true, 110),
    ('Healthcare IT Consulting', 'healthcare-it-consulting', 'DOMAIN_EXPERTISE', d_healthcare, false, true, true, 111),
    ('Cloud Architecture Planning', 'cloud-architecture-planning', 'CONSULTING', d_devops, false, true, true, 112),
    ('Data Analytics Consulting', 'data-analytics-consulting', 'DOMAIN_EXPERTISE', d_ai, false, true, true, 113),
    ('Mobile Strategy', 'mobile-strategy', 'CONSULTING', d_mobile, false, true, true, 114),
    ('Blockchain Consulting', 'blockchain-consulting', 'DOMAIN_EXPERTISE', d_blockchain, false, true, true, 115)
  ON CONFLICT (slug) DO NOTHING;

END $$;
