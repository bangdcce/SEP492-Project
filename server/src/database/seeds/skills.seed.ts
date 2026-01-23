import { DataSource } from 'typeorm';
import { SkillEntity } from '../entities/skill.entity';
import { SkillDomainEntity } from '../entities/skill-domain.entity';

export async function seedSkills(dataSource: DataSource) {
  const skillRepo = dataSource.getRepository(SkillEntity);
  const domainRepo = dataSource.getRepository(SkillDomainEntity);

  // Check if skills already exist
  const existingCount = await skillRepo.count();
  if (existingCount > 0) {
    console.log('✅ Skills already seeded, skipping...');
    return;
  }

  // Get all domains
  const domains = await domainRepo.find();
  const domainMap = new Map(domains.map(d => [d.slug, d.id]));

  const skills = [
    // Web Development
    { name: 'ReactJS', slug: 'reactjs', category: 'FRONTEND', domainSlug: 'web-development', forFreelancer: true, forBroker: false },
    { name: 'Vue.js', slug: 'vuejs', category: 'FRONTEND', domainSlug: 'web-development', forFreelancer: true, forBroker: false },
    { name: 'Angular', slug: 'angular', category: 'FRONTEND', domainSlug: 'web-development', forFreelancer: true, forBroker: false },
    { name: 'Node.js', slug: 'nodejs', category: 'BACKEND', domainSlug: 'web-development', forFreelancer: true, forBroker: false },
    { name: 'Python/Django', slug: 'python-django', category: 'BACKEND', domainSlug: 'web-development', forFreelancer: true, forBroker: false },
    { name: 'PHP/Laravel', slug: 'php-laravel', category: 'BACKEND', domainSlug: 'web-development', forFreelancer: true, forBroker: false },
    { name: 'ASP.NET', slug: 'aspnet', category: 'BACKEND', domainSlug: 'web-development', forFreelancer: true, forBroker: false },
    
    // Mobile Development
    { name: 'React Native', slug: 'react-native', category: 'MOBILE', domainSlug: 'mobile-development', forFreelancer: true, forBroker: false },
    { name: 'Flutter', slug: 'flutter', category: 'MOBILE', domainSlug: 'mobile-development', forFreelancer: true, forBroker: false },
    { name: 'iOS/Swift', slug: 'ios-swift', category: 'MOBILE', domainSlug: 'mobile-development', forFreelancer: true, forBroker: false },
    { name: 'Android/Kotlin', slug: 'android-kotlin', category: 'MOBILE', domainSlug: 'mobile-development', forFreelancer: true, forBroker: false },
    
    // UI/UX Design
    { name: 'Figma', slug: 'figma', category: 'DESIGN', domainSlug: 'ui-ux-design', forFreelancer: true, forBroker: false },
    { name: 'Adobe XD', slug: 'adobe-xd', category: 'DESIGN', domainSlug: 'ui-ux-design', forFreelancer: true, forBroker: false },
    { name: 'Sketch', slug: 'sketch', category: 'DESIGN', domainSlug: 'ui-ux-design', forFreelancer: true, forBroker: false },
    { name: 'UI Design', slug: 'ui-design', category: 'DESIGN', domainSlug: 'ui-ux-design', forFreelancer: true, forBroker: false },
    { name: 'UX Research', slug: 'ux-research', category: 'DESIGN', domainSlug: 'ui-ux-design', forFreelancer: true, forBroker: false },
    
    // Data Science & AI
    { name: 'Machine Learning', slug: 'machine-learning', category: 'AI_ML', domainSlug: 'data-science-ai', forFreelancer: true, forBroker: false },
    { name: 'Python/TensorFlow', slug: 'python-tensorflow', category: 'AI_ML', domainSlug: 'data-science-ai', forFreelancer: true, forBroker: false },
    { name: 'Data Analysis', slug: 'data-analysis', category: 'DATA', domainSlug: 'data-science-ai', forFreelancer: true, forBroker: false },
    { name: 'PyTorch', slug: 'pytorch', category: 'AI_ML', domainSlug: 'data-science-ai', forFreelancer: true, forBroker: false },
    
    // DevOps & Cloud
    { name: 'AWS', slug: 'aws', category: 'DEVOPS', domainSlug: 'devops-cloud', forFreelancer: true, forBroker: false },
    { name: 'Docker', slug: 'docker', category: 'DEVOPS', domainSlug: 'devops-cloud', forFreelancer: true, forBroker: false },
    { name: 'Kubernetes', slug: 'kubernetes', category: 'DEVOPS', domainSlug: 'devops-cloud', forFreelancer: true, forBroker: false },
    { name: 'Azure', slug: 'azure', category: 'DEVOPS', domainSlug: 'devops-cloud', forFreelancer: true, forBroker: false },
    { name: 'CI/CD', slug: 'cicd', category: 'DEVOPS', domainSlug: 'devops-cloud', forFreelancer: true, forBroker: false },
    
    // Content Writing
    { name: 'Technical Writing', slug: 'technical-writing', category: 'OTHER', domainSlug: 'content-writing', forFreelancer: true, forBroker: false },
    { name: 'Copywriting', slug: 'copywriting', category: 'OTHER', domainSlug: 'content-writing', forFreelancer: true, forBroker: false },
    { name: 'Blog Writing', slug: 'blog-writing', category: 'OTHER', domainSlug: 'content-writing', forFreelancer: true, forBroker: false },
    
    // Digital Marketing
    { name: 'SEO', slug: 'seo', category: 'OTHER', domainSlug: 'digital-marketing', forFreelancer: true, forBroker: false },
    { name: 'Social Media Marketing', slug: 'social-media-marketing', category: 'OTHER', domainSlug: 'digital-marketing', forFreelancer: true, forBroker: false },
    { name: 'Google Ads', slug: 'google-ads', category: 'OTHER', domainSlug: 'digital-marketing', forFreelancer: true, forBroker: false },
    
    // Blockchain
    { name: 'Solidity', slug: 'solidity', category: 'OTHER', domainSlug: 'blockchain', forFreelancer: true, forBroker: false },
    { name: 'Smart Contracts', slug: 'smart-contracts', category: 'OTHER', domainSlug: 'blockchain', forFreelancer: true, forBroker: false },
    { name: 'Web3.js', slug: 'web3js', category: 'OTHER', domainSlug: 'blockchain', forFreelancer: true, forBroker: false },
    
    // Game Development
    { name: 'Unity', slug: 'unity', category: 'OTHER', domainSlug: 'game-development', forFreelancer: true, forBroker: false },
    { name: 'Unreal Engine', slug: 'unreal-engine', category: 'OTHER', domainSlug: 'game-development', forFreelancer: true, forBroker: false },
    { name: 'C#', slug: 'csharp', category: 'BACKEND', domainSlug: 'game-development', forFreelancer: true, forBroker: false },
    
    // Quality Assurance
    { name: 'Manual Testing', slug: 'manual-testing', category: 'TESTING', domainSlug: 'quality-assurance', forFreelancer: true, forBroker: false },
    { name: 'Automation Testing', slug: 'automation-testing', category: 'TESTING', domainSlug: 'quality-assurance', forFreelancer: true, forBroker: false },
    { name: 'Selenium', slug: 'selenium', category: 'TESTING', domainSlug: 'quality-assurance', forFreelancer: true, forBroker: false },
    
    // Broker skills (Business & Management)
    { name: 'Project Management', slug: 'project-management', category: 'PROJECT_MANAGEMENT', domainSlug: null, forFreelancer: false, forBroker: true },
    { name: 'Client Communication', slug: 'client-communication', category: 'BUSINESS_ANALYSIS', domainSlug: null, forFreelancer: false, forBroker: true },
    { name: 'Requirement Analysis', slug: 'requirement-analysis', category: 'BUSINESS_ANALYSIS', domainSlug: null, forFreelancer: false, forBroker: true },
    { name: 'Team Coordination', slug: 'team-coordination', category: 'PROJECT_MANAGEMENT', domainSlug: null, forFreelancer: false, forBroker: true },
    { name: 'Contract Negotiation', slug: 'contract-negotiation', category: 'CONSULTING', domainSlug: null, forFreelancer: false, forBroker: true },
  ];

  const skillEntities = skills.map((skill, index) => ({
    name: skill.name,
    slug: skill.slug,
    category: skill.category as any,
    domainId: skill.domainSlug ? domainMap.get(skill.domainSlug) : null,
    forFreelancer: skill.forFreelancer,
    forBroker: skill.forBroker,
    isActive: true,
    sortOrder: index,
  }));

  await skillRepo.save(skillEntities as any);
  console.log('✅ Successfully seeded', skillEntities.length, 'skills');
}
