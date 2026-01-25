import { DataSource } from 'typeorm';
import { SkillDomainEntity } from '../entities/skill-domain.entity';

export async function seedSkillDomains(dataSource: DataSource) {
  const domainRepo = dataSource.getRepository(SkillDomainEntity);

  // Check if domains already exist
  const existingCount = await domainRepo.count();
  if (existingCount > 0) {
    console.log('✅ Skill domains already seeded, skipping...');
    return;
  }

  const domains = [
    {
      name: 'Web Development',
      slug: 'web-development',
      description: 'Frontend, Backend, Full-stack web applications',
      icon: '🌐',
      sortOrder: 1,
    },
    {
      name: 'Mobile Development',
      slug: 'mobile-development',
      description: 'iOS, Android, React Native, Flutter apps',
      icon: '📱',
      sortOrder: 2,
    },
    {
      name: 'UI/UX Design',
      slug: 'ui-ux-design',
      description: 'User Interface and User Experience design',
      icon: '🎨',
      sortOrder: 3,
    },
    {
      name: 'Data Science & AI',
      slug: 'data-science-ai',
      description: 'Machine Learning, Data Analysis, AI solutions',
      icon: '🤖',
      sortOrder: 4,
    },
    {
      name: 'DevOps & Cloud',
      slug: 'devops-cloud',
      description: 'CI/CD, Cloud infrastructure, System administration',
      icon: '☁️',
      sortOrder: 5,
    },
    {
      name: 'Content Writing',
      slug: 'content-writing',
      description: 'Technical writing, Copywriting, Blog posts',
      icon: '✍️',
      sortOrder: 6,
    },
    {
      name: 'Digital Marketing',
      slug: 'digital-marketing',
      description: 'SEO, Social Media, Email marketing',
      icon: '📊',
      sortOrder: 7,
    },
    {
      name: 'Blockchain',
      slug: 'blockchain',
      description: 'Smart contracts, DeFi, Web3 development',
      icon: '⛓️',
      sortOrder: 8,
    },
    {
      name: 'Game Development',
      slug: 'game-development',
      description: 'Unity, Unreal Engine, 2D/3D games',
      icon: '🎮',
      sortOrder: 9,
    },
    {
      name: 'Quality Assurance',
      slug: 'quality-assurance',
      description: 'Software testing, Automation, QA processes',
      icon: '🔍',
      sortOrder: 10,
    },
  ];

  await domainRepo.save(domains);
  console.log('✅ Successfully seeded', domains.length, 'skill domains');
}
