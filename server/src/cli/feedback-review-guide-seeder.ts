import * as bcrypt from 'bcryptjs';
import AppDataSource from '../data-source';
import {
  ReviewEntity,
  TrustScoreHistoryEntity,
  UserEntity,
} from '../database/entities';
import { TrustScoreService } from '../modules/trust-score/trust-score.service';

type MainActorKey = 'client' | 'broker' | 'freelancer';
type SupportActorKey =
  | 'bookingSpecialist'
  | 'growthClient'
  | 'opsClient'
  | 'automationFreelancer'
  | 'supportBroker';
type ActorKey = MainActorKey | SupportActorKey;
type ProjectKey =
  | 'bookingRefresh'
  | 'memberPortal'
  | 'operationsDashboard'
  | 'loyaltyMicrosite'
  | 'cedarSaltMigration'
  | 'meridianAutomation'
  | 'harborReferralAnalytics'
  | 'staffEnablementHub';

interface ActorSeedConfig<K extends ActorKey = ActorKey> {
  key: K;
  preferredId: string;
  email: string;
  fullName: string;
  role: 'CLIENT' | 'BROKER' | 'FREELANCER';
  bio: string;
  companyName: string | null;
  skills: string[];
  avatarUrl: string;
}

interface ArchiveActorSeedConfig {
  preferredId: string;
  email: string;
  fullName: string;
  role: 'CLIENT' | 'BROKER' | 'FREELANCER';
}

interface ResolvedActor {
  key: ActorKey;
  id: string;
  email: string;
  fullName: string;
  role: 'CLIENT' | 'BROKER' | 'FREELANCER';
}

interface ProjectFixture {
  key: ProjectKey;
  requestId: string;
  specId: string;
  projectId: string;
  clientActorKey: ActorKey;
  brokerActorKey: ActorKey;
  freelancerActorKey: ActorKey;
  title: string;
  description: string;
  requestStatus: string;
  projectStatus: 'PAID' | 'COMPLETED';
  projectCategoryName: string;
  projectCategorySlug: string;
  budgetRange: string;
  totalBudget: number;
  estimatedTimeline: string;
  requestedDeadline: string;
  techPreferences: string;
  startOffsetDays: number;
  endOffsetDays: number;
  updatedOffsetDays: number;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    amount: number;
    deliverableType: string;
    status: string;
    retentionAmount: number;
    startOffsetDays: number;
    dueOffsetDays: number;
    sortOrder: number;
    acceptanceCriteria: string[];
    escrowId?: string;
  }>;
  featureSeed: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE';
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    acceptanceCriteria: string[];
  }>;
}

interface ReviewFixture {
  id: string;
  projectKey: ProjectKey;
  reviewer: ActorKey;
  target: ActorKey;
  rating: number;
  comment: string;
  weight: number;
  createdOffsetDays: number;
}

interface SeedContractRecord {
  id: string;
  title: string;
  contractUrl: string;
  termsContent: string;
  contentHash: string;
  activatedAt: string;
  verifiedAt: string;
  milestoneSnapshot: Array<{
    contractMilestoneKey: string;
    sourceSpecMilestoneId: string;
    title: string;
    description: string;
    amount: number;
    startDate: string;
    dueDate: string;
    sortOrder: number;
    deliverableType: string;
    retentionAmount: number;
    acceptanceCriteria: string[];
    projectMilestoneId: string;
  }>;
  commercialContext: Record<string, unknown>;
}

interface SeedTaskRecord {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  sortOrder: number;
  submissionNote: string;
  proofLink: string;
  submittedAt: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  storyPoints: number;
  startDate: string;
  labels: string[];
}

const DEMO_PASSWORD = 'password123';
const BCRYPT_SALT_ROUNDS = 12;
const BASE_CURRENCY = 'USD';
const PLATFORM_SPLIT = {
  developerPercentage: 85,
  brokerPercentage: 10,
  platformPercentage: 5,
};
const MAIN_ACTORS: ActorSeedConfig<MainActorKey>[] = [
  {
    key: 'client',
    preferredId: 'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    email: 'client.test.new@example.com',
    fullName: 'Linh Tran',
    role: 'CLIENT',
    bio: 'Founder at Northstar Wellness, coordinating a phased digital modernization roadmap for member services.',
    companyName: 'Northstar Wellness Co., Ltd.',
    skills: ['Product Strategy', 'Service Operations', 'Vendor Management'],
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Linh%20Tran',
  },
  {
    key: 'broker',
    preferredId: '261430db-300b-4481-b0c4-dc032c656057',
    email: 'broker.test.new@example.com',
    fullName: 'Minh Dao',
    role: 'BROKER',
    bio: 'Independent broker specializing in wellness and service-business digital delivery.',
    companyName: null,
    skills: ['Project Scoping', 'Vendor Matching', 'Delivery Coordination'],
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Minh%20Dao',
  },
  {
    key: 'freelancer',
    preferredId: '12ebc462-d122-4a3a-914a-1a7f08064090',
    email: 'freelancer.test.new@example.com',
    fullName: 'Khoa Pham',
    role: 'FREELANCER',
    bio: 'Full-stack product engineer focused on member portals, operations dashboards, and conversion-focused web experiences.',
    companyName: null,
    skills: ['React', 'NestJS', 'PostgreSQL', 'Cloud Delivery', 'UX Engineering'],
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Khoa%20Pham',
  },
];

const SUPPORTING_ACTORS: ActorSeedConfig<SupportActorKey>[] = [
  {
    key: 'bookingSpecialist',
    preferredId: '91a11111-1111-4111-8111-111111111111',
    email: 'quynh.vo.demo@example.com',
    fullName: 'Quynh Vo',
    role: 'FREELANCER',
    bio: 'Conversion-focused frontend specialist supporting launch-heavy booking and campaign projects.',
    companyName: null,
    skills: ['Conversion UX', 'React', 'Landing Pages', 'Experiment Design'],
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Quynh%20Vo',
  },
  {
    key: 'growthClient',
    preferredId: '91a22222-2222-4222-8222-222222222222',
    email: 'maya.nguyen.demo@example.com',
    fullName: 'Maya Nguyen',
    role: 'CLIENT',
    bio: 'Growth lead coordinating multi-location wellness marketing and digital booking rollouts.',
    companyName: 'Cedar & Salt Studio',
    skills: ['Growth Campaigns', 'Operations Rollout', 'Stakeholder Alignment'],
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Maya%20Nguyen',
  },
  {
    key: 'opsClient',
    preferredId: '91a33333-3333-4333-8333-333333333333',
    email: 'thao.le.demo@example.com',
    fullName: 'Thao Le',
    role: 'CLIENT',
    bio: 'Operations director driving service delivery automation for therapy and wellness teams.',
    companyName: 'Meridian Physiotherapy Group',
    skills: ['Operations Design', 'Service Delivery', 'Internal Tooling'],
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Thao%20Le',
  },
  {
    key: 'automationFreelancer',
    preferredId: '91a44444-4444-4444-8444-444444444444',
    email: 'duc.ho.demo@example.com',
    fullName: 'Duc Ho',
    role: 'FREELANCER',
    bio: 'Product engineer specializing in internal tooling, automation flows, and analytics handoff.',
    companyName: null,
    skills: ['NestJS', 'Workflow Automation', 'Analytics', 'PostgreSQL'],
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Duc%20Ho',
  },
  {
    key: 'supportBroker',
    preferredId: '91a55555-5555-4555-8555-555555555555',
    email: 'nhi.truong.demo@example.com',
    fullName: 'Nhi Truong',
    role: 'BROKER',
    bio: 'Broker handling internal enablement and document-heavy delivery tracks for service businesses.',
    companyName: null,
    skills: ['Service Design', 'Delivery Governance', 'Client Facilitation'],
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Nhi%20Truong',
  },
];

const ARCHIVE_ACTORS: ArchiveActorSeedConfig[] = [
  {
    preferredId: '8f111111-1111-4111-8111-111111111111',
    email: 'archive.client.feedback@example.com',
    fullName: 'Archive Client Reserve',
    role: 'CLIENT',
  },
  {
    preferredId: '8f222222-2222-4222-8222-222222222222',
    email: 'archive.broker.feedback@example.com',
    fullName: 'Archive Broker Reserve',
    role: 'BROKER',
  },
  {
    preferredId: '8f333333-3333-4333-8333-333333333333',
    email: 'archive.freelancer.feedback@example.com',
    fullName: 'Archive Freelancer Reserve',
    role: 'FREELANCER',
  },
];

const PROJECT_FIXTURES: ProjectFixture[] = [
  {
    key: 'bookingRefresh',
    requestId: '6a111111-1111-4111-8111-111111111111',
    specId: '6b111111-1111-4111-8111-111111111111',
    projectId: '6c111111-1111-4111-8111-111111111111',
    clientActorKey: 'client',
    brokerActorKey: 'broker',
    freelancerActorKey: 'bookingSpecialist',
    title: 'Northstar Wellness Booking Website Refresh',
    description:
      'Refresh the public booking website for Northstar Wellness so new clients can compare services, see practitioner availability, and complete bookings without phone follow-up.',
    requestStatus: 'CONVERTED_TO_PROJECT',
    projectStatus: 'PAID',
    projectCategoryName: 'Appointment Booking Experience',
    projectCategorySlug: 'appointment-booking-experience',
    budgetRange: '$15,000 - $20,000',
    totalBudget: 18000,
    estimatedTimeline: '8 weeks',
    requestedDeadline: '2026-02-05',
    techPreferences: 'React, NestJS, PostgreSQL, responsive UX',
    startOffsetDays: 84,
    endOffsetDays: 63,
    updatedOffsetDays: 62,
    milestones: [
      {
        id: '6d111111-1111-4111-8111-111111111111',
        escrowId: '6e111111-1111-4111-8111-111111111111',
        title: 'Service discovery and booking UX',
        description:
          'Map booking rules, redesign the service catalog, and validate the new mobile-first booking path.',
        amount: 7000,
        deliverableType: 'DESIGN_PROTOTYPE',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 84,
        dueOffsetDays: 76,
        sortOrder: 1,
        acceptanceCriteria: [
          'Booking flow covers intake, service selection, and practitioner availability.',
          'Responsive prototype approved by client and broker.',
        ],
      },
      {
        id: '6d111112-1111-4111-8111-111111111111',
        escrowId: '6e111112-1111-4111-8111-111111111111',
        title: 'Build, QA, and launch handoff',
        description:
          'Implement the booking funnel, analytics events, and hand off launch playbooks for the front-desk team.',
        amount: 11000,
        deliverableType: 'DEPLOYMENT',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 75,
        dueOffsetDays: 63,
        sortOrder: 2,
        acceptanceCriteria: [
          'Production booking flow is live and tracks conversion events.',
          'Launch checklist and rollback notes are delivered to the client.',
        ],
      },
    ],
    featureSeed: [
      {
        id: 'feat-booking-1',
        title: 'Guided booking wizard',
        description: 'Let new clients choose service, practitioner, and preferred time in a single guided flow.',
        priority: 'MUST_HAVE',
        complexity: 'HIGH',
        acceptanceCriteria: [
          'Wizard preserves progress when users step backward.',
          'The system blocks unavailable slots before checkout.',
        ],
      },
      {
        id: 'feat-booking-2',
        title: 'Conversion analytics dashboard',
        description: 'Track booking drop-off, repeat visits, and conversion by service page.',
        priority: 'SHOULD_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Campaign source is stored on completed bookings.',
          'Broker and client can see weekly conversion summaries.',
        ],
      },
    ],
  },
  {
    key: 'memberPortal',
    requestId: '6a222222-2222-4222-8222-222222222222',
    specId: '6b222222-2222-4222-8222-222222222222',
    projectId: '6c222222-2222-4222-8222-222222222222',
    clientActorKey: 'client',
    brokerActorKey: 'broker',
    freelancerActorKey: 'freelancer',
    title: 'Northstar Wellness Member Portal MVP',
    description:
      'Launch a secure member portal so recurring wellness clients can manage profiles, see treatment history, and self-serve billing questions.',
    requestStatus: 'CONVERTED_TO_PROJECT',
    projectStatus: 'PAID',
    projectCategoryName: 'Member Self-Service',
    projectCategorySlug: 'member-self-service',
    budgetRange: '$24,000 - $30,000',
    totalBudget: 26000,
    estimatedTimeline: '10 weeks',
    requestedDeadline: '2026-02-28',
    techPreferences: 'React, NestJS, role-based access, secure file delivery',
    startOffsetDays: 58,
    endOffsetDays: 36,
    updatedOffsetDays: 35,
    milestones: [
      {
        id: '6d222221-2222-4222-8222-222222222222',
        escrowId: '6e222221-2222-4222-8222-222222222222',
        title: 'Authentication and member profile center',
        description:
          'Deliver secure sign-in, profile management, and account recovery flows for members.',
        amount: 12000,
        deliverableType: 'SOURCE_CODE',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 58,
        dueOffsetDays: 47,
        sortOrder: 1,
        acceptanceCriteria: [
          'Members can update contact preferences and saved details.',
          'Support team can verify access issues without direct password handling.',
        ],
      },
      {
        id: '6d222222-2222-4222-8222-222222222222',
        escrowId: '6e222222-2222-4222-8222-222222222222',
        title: 'Treatment history and billing help center',
        description:
          'Expose visit history, package usage, and billing support workflows in the portal.',
        amount: 14000,
        deliverableType: 'DEPLOYMENT',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 46,
        dueOffsetDays: 36,
        sortOrder: 2,
        acceptanceCriteria: [
          'Members can view past visits and package balance without staff assistance.',
          'Billing support requests are routed with category-specific context.',
        ],
      },
    ],
    featureSeed: [
      {
        id: 'feat-portal-1',
        title: 'Member dashboard',
        description: 'Show upcoming appointments, active packages, and support actions after login.',
        priority: 'MUST_HAVE',
        complexity: 'HIGH',
        acceptanceCriteria: [
          'Dashboard renders account summary within one page load.',
          'Upcoming bookings and package status are shown from the same view.',
        ],
      },
      {
        id: 'feat-portal-2',
        title: 'Billing support intake',
        description: 'Allow members to raise billing issues with screenshots and context.',
        priority: 'SHOULD_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Support request includes invoice reference and problem type.',
          'Staff can track request status from the member portal.',
        ],
      },
    ],
  },
  {
    key: 'operationsDashboard',
    requestId: '6a333333-3333-4333-8333-333333333333',
    specId: '6b333333-3333-4333-8333-333333333333',
    projectId: '6c333333-3333-4333-8333-333333333333',
    clientActorKey: 'client',
    brokerActorKey: 'broker',
    freelancerActorKey: 'freelancer',
    title: 'Northstar Wellness Operations Dashboard',
    description:
      'Create an internal dashboard for scheduling managers to track utilization, revenue health, and practitioner capacity without exporting spreadsheets.',
    requestStatus: 'CONVERTED_TO_PROJECT',
    projectStatus: 'PAID',
    projectCategoryName: 'Operations Analytics',
    projectCategorySlug: 'operations-analytics',
    budgetRange: '$20,000 - $25,000',
    totalBudget: 22000,
    estimatedTimeline: '9 weeks',
    requestedDeadline: '2026-03-18',
    techPreferences: 'React, analytics visualizations, PostgreSQL reporting',
    startOffsetDays: 34,
    endOffsetDays: 16,
    updatedOffsetDays: 15,
    milestones: [
      {
        id: '6d333331-3333-4333-8333-333333333333',
        escrowId: '6e333331-3333-4333-8333-333333333333',
        title: 'Scheduling and staffing insight layer',
        description:
          'Surface utilization, open capacity, and practitioner scheduling gaps for operations leads.',
        amount: 10000,
        deliverableType: 'SOURCE_CODE',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 34,
        dueOffsetDays: 25,
        sortOrder: 1,
        acceptanceCriteria: [
          'Managers can filter utilization by location and practitioner.',
          'Dashboard highlights open capacity windows for the next two weeks.',
        ],
      },
      {
        id: '6d333332-3333-4333-8333-333333333333',
        escrowId: '6e333332-3333-4333-8333-333333333333',
        title: 'Revenue and retention reporting workspace',
        description:
          'Add revenue trend views, membership retention snapshots, and share-ready exports for leadership.',
        amount: 12000,
        deliverableType: 'API_DOCS',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 24,
        dueOffsetDays: 16,
        sortOrder: 2,
        acceptanceCriteria: [
          'Leadership can compare week-over-week revenue by location.',
          'Reports export with stable filters for monthly business reviews.',
        ],
      },
    ],
    featureSeed: [
      {
        id: 'feat-ops-1',
        title: 'Utilization dashboard',
        description: 'Track practitioner capacity and upcoming staffing gaps from a single screen.',
        priority: 'MUST_HAVE',
        complexity: 'HIGH',
        acceptanceCriteria: [
          'Dashboard shows utilization percentage by team and location.',
          'Users can switch between daily and weekly views.',
        ],
      },
      {
        id: 'feat-ops-2',
        title: 'Leadership revenue snapshot',
        description: 'Provide a quick readout of revenue, retention, and campaign performance.',
        priority: 'SHOULD_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Revenue widgets update from reporting data without spreadsheet uploads.',
          'Exports preserve the selected date range and filter set.',
        ],
      },
    ],
  },
  {
    key: 'loyaltyMicrosite',
    requestId: '6a444444-4444-4444-8444-444444444444',
    specId: '6b444444-4444-4444-8444-444444444444',
    projectId: '6c444444-4444-4444-8444-444444444444',
    clientActorKey: 'client',
    brokerActorKey: 'broker',
    freelancerActorKey: 'freelancer',
    title: 'Northstar Wellness Loyalty Campaign Microsite',
    description:
      'Ship a campaign microsite for Northstar Wellness loyalty referrals with a lightweight CRM handoff so the marketing team can launch a seasonal acquisition push.',
    requestStatus: 'CONVERTED_TO_PROJECT',
    projectStatus: 'COMPLETED',
    projectCategoryName: 'Campaign Microsite',
    projectCategorySlug: 'campaign-microsite',
    budgetRange: '$10,000 - $14,000',
    totalBudget: 12000,
    estimatedTimeline: '6 weeks',
    requestedDeadline: '2026-04-04',
    techPreferences: 'React landing experience, CRM integration, lightweight analytics',
    startOffsetDays: 12,
    endOffsetDays: 4,
    updatedOffsetDays: 3,
    milestones: [
      {
        id: '6d444441-4444-4444-8444-444444444444',
        escrowId: '6e444441-4444-4444-8444-444444444444',
        title: 'Campaign landing page and referral journey',
        description:
          'Design and build the referral-first microsite flow for campaign launch.',
        amount: 5000,
        deliverableType: 'DEPLOYMENT',
        status: 'COMPLETED',
        retentionAmount: 0,
        startOffsetDays: 12,
        dueOffsetDays: 8,
        sortOrder: 1,
        acceptanceCriteria: [
          'Landing page captures referral leads with campaign source data.',
          'Marketing team can update launch copy without developer support.',
        ],
      },
      {
        id: '6d444442-4444-4444-8444-444444444444',
        escrowId: '6e444442-4444-4444-8444-444444444444',
        title: 'CRM sync and analytics handoff',
        description:
          'Connect form submissions to CRM routing and finalize launch analytics.',
        amount: 7000,
        deliverableType: 'SOURCE_CODE',
        status: 'COMPLETED',
        retentionAmount: 0,
        startOffsetDays: 7,
        dueOffsetDays: 4,
        sortOrder: 2,
        acceptanceCriteria: [
          'Referral leads sync to CRM with campaign tags.',
          'Client receives a lightweight post-launch analytics checklist.',
        ],
      },
    ],
    featureSeed: [
      {
        id: 'feat-loyalty-1',
        title: 'Referral microsite',
        description: 'Capture seasonal referral leads with a focused campaign landing experience.',
        priority: 'MUST_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Referral code and lead source are stored with each submission.',
          'The mobile form takes less than two minutes to complete.',
        ],
      },
      {
        id: 'feat-loyalty-2',
        title: 'CRM-ready lead sync',
        description: 'Send campaign leads into the client CRM with routing labels.',
        priority: 'SHOULD_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'New referrals appear in CRM with campaign attribution.',
          'Failed CRM submissions can be retried without data loss.',
        ],
      },
    ],
  },
  {
    key: 'cedarSaltMigration',
    requestId: '6a555555-5555-4555-8555-555555555555',
    specId: '6b555555-5555-4555-8555-555555555555',
    projectId: '6c555555-5555-4555-8555-555555555555',
    clientActorKey: 'growthClient',
    brokerActorKey: 'broker',
    freelancerActorKey: 'automationFreelancer',
    title: 'Cedar & Salt Studio Multi-Location Booking Migration',
    description:
      'Consolidate fragmented booking flows across Cedar & Salt Studio locations into one shared conversion path with cleaner appointment intake.',
    requestStatus: 'CONVERTED_TO_PROJECT',
    projectStatus: 'PAID',
    projectCategoryName: 'Booking Platform Modernization',
    projectCategorySlug: 'booking-platform-modernization',
    budgetRange: '$18,000 - $24,000',
    totalBudget: 21000,
    estimatedTimeline: '8 weeks',
    requestedDeadline: '2026-01-24',
    techPreferences: 'React, booking integrations, analytics, launch QA',
    startOffsetDays: 102,
    endOffsetDays: 80,
    updatedOffsetDays: 79,
    milestones: [
      {
        id: '6d555551-5555-4555-8555-555555555555',
        escrowId: '6e555551-5555-4555-8555-555555555555',
        title: 'Location flow consolidation',
        description:
          'Map existing booking paths, unify service taxonomy, and validate a single intake structure across locations.',
        amount: 9000,
        deliverableType: 'DESIGN_PROTOTYPE',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 102,
        dueOffsetDays: 92,
        sortOrder: 1,
        acceptanceCriteria: [
          'All locations use a shared service and booking taxonomy.',
          'Stakeholders approve a single mobile booking path.',
        ],
      },
      {
        id: '6d555552-5555-4555-8555-555555555555',
        escrowId: '6e555552-5555-4555-8555-555555555555',
        title: 'Migration, QA, and launch readiness',
        description:
          'Ship the consolidated booking stack, validate location-specific edge cases, and hand off the rollout checklist.',
        amount: 12000,
        deliverableType: 'DEPLOYMENT',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 91,
        dueOffsetDays: 80,
        sortOrder: 2,
        acceptanceCriteria: [
          'Booking conversion events track correctly for every location.',
          'Launch checklist covers rollback, monitoring, and staff enablement.',
        ],
      },
    ],
    featureSeed: [
      {
        id: 'feat-cedar-1',
        title: 'Unified multi-location booking',
        description: 'Let clients switch locations without restarting the booking journey.',
        priority: 'MUST_HAVE',
        complexity: 'HIGH',
        acceptanceCriteria: [
          'Location change preserves selected service and context.',
          'Analytics distinguish between location intent and completion.',
        ],
      },
      {
        id: 'feat-cedar-2',
        title: 'Launch operations dashboard',
        description: 'Give studio managers visibility into migration health and conversion.',
        priority: 'SHOULD_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Managers can compare old versus new conversion metrics.',
          'Issue tracking notes are visible from the rollout workspace.',
        ],
      },
    ],
  },
  {
    key: 'meridianAutomation',
    requestId: '6a666666-6666-4666-8666-666666666666',
    specId: '6b666666-6666-4666-8666-666666666666',
    projectId: '6c666666-6666-4666-8666-666666666666',
    clientActorKey: 'opsClient',
    brokerActorKey: 'broker',
    freelancerActorKey: 'bookingSpecialist',
    title: 'Meridian Physiotherapy Intake Automation',
    description:
      'Replace manual intake triage with a guided digital flow for Meridian Physiotherapy so staff can process new inquiries faster and with cleaner routing.',
    requestStatus: 'CONVERTED_TO_PROJECT',
    projectStatus: 'PAID',
    projectCategoryName: 'Service Intake Automation',
    projectCategorySlug: 'service-intake-automation',
    budgetRange: '$16,000 - $22,000',
    totalBudget: 19000,
    estimatedTimeline: '7 weeks',
    requestedDeadline: '2026-02-12',
    techPreferences: 'Guided forms, workflow automation, role-based internal dashboard',
    startOffsetDays: 90,
    endOffsetDays: 67,
    updatedOffsetDays: 66,
    milestones: [
      {
        id: '6d666661-6666-4666-8666-666666666666',
        escrowId: '6e666661-6666-4666-8666-666666666666',
        title: 'Intake decision tree and routing design',
        description:
          'Model intake rules, triage paths, and staff routing before implementation.',
        amount: 8000,
        deliverableType: 'DESIGN_PROTOTYPE',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 90,
        dueOffsetDays: 80,
        sortOrder: 1,
        acceptanceCriteria: [
          'Intake rules cover urgent, standard, and follow-up scenarios.',
          'Operations team approves routing outputs and escalation paths.',
        ],
      },
      {
        id: '6d666662-6666-4666-8666-666666666666',
        escrowId: '6e666662-6666-4666-8666-666666666666',
        title: 'Automation rollout and internal handoff',
        description:
          'Deploy the triage workflow, staff queue, and training-ready playbook for launch.',
        amount: 11000,
        deliverableType: 'DEPLOYMENT',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 79,
        dueOffsetDays: 67,
        sortOrder: 2,
        acceptanceCriteria: [
          'New inquiries route automatically into the right queue.',
          'Staff can see assignment reasons and follow-up expectations.',
        ],
      },
    ],
    featureSeed: [
      {
        id: 'feat-meridian-1',
        title: 'Guided intake triage',
        description: 'Collect service need, urgency, and history without manual staff screening.',
        priority: 'MUST_HAVE',
        complexity: 'HIGH',
        acceptanceCriteria: [
          'Each answer path maps to a deterministic routing outcome.',
          'Users can complete triage from mobile without losing progress.',
        ],
      },
      {
        id: 'feat-meridian-2',
        title: 'Staff routing inbox',
        description: 'Show why each intake item was assigned and what should happen next.',
        priority: 'SHOULD_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Inbox cards expose urgency and assignment rationale.',
          'Managers can monitor unresolved intake backlog.',
        ],
      },
    ],
  },
  {
    key: 'harborReferralAnalytics',
    requestId: '6a777777-7777-4777-8777-777777777777',
    specId: '6b777777-7777-4777-8777-777777777777',
    projectId: '6c777777-7777-4777-8777-777777777777',
    clientActorKey: 'growthClient',
    brokerActorKey: 'broker',
    freelancerActorKey: 'automationFreelancer',
    title: 'Harbor Pilates Referral Analytics Sprint',
    description:
      'Stand up a lightweight analytics layer for Harbor Pilates referral campaigns so leadership can see which channels produce retained clients.',
    requestStatus: 'CONVERTED_TO_PROJECT',
    projectStatus: 'COMPLETED',
    projectCategoryName: 'Campaign Analytics',
    projectCategorySlug: 'campaign-analytics',
    budgetRange: '$9,000 - $12,000',
    totalBudget: 10500,
    estimatedTimeline: '5 weeks',
    requestedDeadline: '2026-03-05',
    techPreferences: 'Analytics events, CRM exports, lightweight reporting',
    startOffsetDays: 44,
    endOffsetDays: 23,
    updatedOffsetDays: 22,
    milestones: [
      {
        id: '6d777771-7777-4777-8777-777777777777',
        escrowId: '6e777771-7777-4777-8777-777777777777',
        title: 'Referral event model',
        description:
          'Define referral attribution, conversion checkpoints, and reporting structure.',
        amount: 4200,
        deliverableType: 'SOURCE_CODE',
        status: 'COMPLETED',
        retentionAmount: 0,
        startOffsetDays: 44,
        dueOffsetDays: 33,
        sortOrder: 1,
        acceptanceCriteria: [
          'Referral source persists from landing through qualified lead.',
          'Reporting model supports weekly executive snapshots.',
        ],
      },
      {
        id: '6d777772-7777-4777-8777-777777777777',
        escrowId: '6e777772-7777-4777-8777-777777777777',
        title: 'Executive reporting handoff',
        description:
          'Package the analytics views, export workflows, and interpretation notes for leadership.',
        amount: 6300,
        deliverableType: 'API_DOCS',
        status: 'COMPLETED',
        retentionAmount: 0,
        startOffsetDays: 32,
        dueOffsetDays: 23,
        sortOrder: 2,
        acceptanceCriteria: [
          'Leadership can compare referral channels by conversion and retention.',
          'Export notes explain campaign attribution caveats.',
        ],
      },
    ],
    featureSeed: [
      {
        id: 'feat-harbor-1',
        title: 'Referral channel attribution',
        description: 'Track which referral channels create qualified clients and retained members.',
        priority: 'MUST_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Channel attribution survives CRM sync and export.',
          'Qualified lead and retained member events are linked.',
        ],
      },
      {
        id: 'feat-harbor-2',
        title: 'Executive reporting pack',
        description: 'Create a reporting view that leadership can review without analyst help.',
        priority: 'SHOULD_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Weekly summary exports are generated from the same view.',
          'The pack highlights top-performing referral channels.',
        ],
      },
    ],
  },
  {
    key: 'staffEnablementHub',
    requestId: '6a888888-8888-4888-8888-888888888888',
    specId: '6b888888-8888-4888-8888-888888888888',
    projectId: '6c888888-8888-4888-8888-888888888888',
    clientActorKey: 'client',
    brokerActorKey: 'supportBroker',
    freelancerActorKey: 'freelancer',
    title: 'Northstar Wellness Staff Enablement Hub',
    description:
      'Create an internal enablement hub so front-desk and operations staff can access rollout notes, service updates, and launch playbooks in one place.',
    requestStatus: 'CONVERTED_TO_PROJECT',
    projectStatus: 'PAID',
    projectCategoryName: 'Internal Enablement',
    projectCategorySlug: 'internal-enablement',
    budgetRange: '$11,000 - $15,000',
    totalBudget: 13000,
    estimatedTimeline: '6 weeks',
    requestedDeadline: '2026-02-22',
    techPreferences: 'Content workflows, access control, lightweight CMS experience',
    startOffsetDays: 70,
    endOffsetDays: 48,
    updatedOffsetDays: 47,
    milestones: [
      {
        id: '6d888881-8888-4888-8888-888888888888',
        escrowId: '6e888881-8888-4888-8888-888888888888',
        title: 'Enablement content structure',
        description:
          'Design the information architecture for rollout notes, SOPs, and launch updates.',
        amount: 5000,
        deliverableType: 'DESIGN_PROTOTYPE',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 70,
        dueOffsetDays: 60,
        sortOrder: 1,
        acceptanceCriteria: [
          'Staff can find launch notes and SOPs by function and rollout phase.',
          'Content ownership is clear for future updates.',
        ],
      },
      {
        id: '6d888882-8888-4888-8888-888888888888',
        escrowId: '6e888882-8888-4888-8888-888888888888',
        title: 'Hub build and rollout support',
        description:
          'Ship the enablement hub and hand off update workflows to the internal operations team.',
        amount: 8000,
        deliverableType: 'DEPLOYMENT',
        status: 'PAID',
        retentionAmount: 0,
        startOffsetDays: 59,
        dueOffsetDays: 48,
        sortOrder: 2,
        acceptanceCriteria: [
          'Staff can browse rollout content without editing privileges.',
          'Operations leads can publish updates without engineering support.',
        ],
      },
    ],
    featureSeed: [
      {
        id: 'feat-enablement-1',
        title: 'Rollout content hub',
        description: 'Centralize SOPs, launch notes, and service updates for internal teams.',
        priority: 'MUST_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Staff can browse content by rollout phase and audience.',
          'The hub supports publishing and archiving updates.',
        ],
      },
      {
        id: 'feat-enablement-2',
        title: 'Internal publishing workflow',
        description: 'Allow operations leads to update enablement content without code changes.',
        priority: 'SHOULD_HAVE',
        complexity: 'MEDIUM',
        acceptanceCriteria: [
          'Publishing changes are visible immediately to staff readers.',
          'Draft updates can be reviewed before release.',
        ],
      },
    ],
  },
];

const REVIEW_FIXTURES: ReviewFixture[] = [
  {
    id: '6f111111-1111-4111-8111-111111111111',
    projectKey: 'bookingRefresh',
    reviewer: 'client',
    target: 'broker',
    rating: 5,
    comment:
      'Minh translated our service requirements into a phased delivery plan and kept vendor handoffs calm even when booking rules changed mid-sprint.',
    weight: 1.5,
    createdOffsetDays: 55,
  },
  {
    id: '6f111112-1111-4111-8111-111111111111',
    projectKey: 'bookingRefresh',
    reviewer: 'bookingSpecialist',
    target: 'broker',
    rating: 5,
    comment:
      'Minh kept booking scope decisions crisp, protected delivery when stakeholders added late campaign asks, and made launch-day coordination much easier on the implementation side.',
    weight: 1.5,
    createdOffsetDays: 54,
  },
  {
    id: '6f222222-2222-4222-8222-222222222222',
    projectKey: 'memberPortal',
    reviewer: 'broker',
    target: 'freelancer',
    rating: 4,
    comment:
      'Khoa delivered a strong portal foundation and flagged blockers early. We needed one extra revision round on member notification copy, but the engineering quality was reliable.',
    weight: 1.5,
    createdOffsetDays: 30,
  },
  {
    id: '6f333333-3333-4333-8333-333333333333',
    projectKey: 'operationsDashboard',
    reviewer: 'freelancer',
    target: 'client',
    rating: 5,
    comment:
      'Linh gave fast decisions, documented edge cases clearly, and approved scope changes without turning the dashboard rollout into churn.',
    weight: 1.5,
    createdOffsetDays: 12,
  },
  {
    id: '6f555555-5555-4555-8555-555555555555',
    projectKey: 'cedarSaltMigration',
    reviewer: 'growthClient',
    target: 'broker',
    rating: 5,
    comment:
      'Minh was unusually strong at stakeholder management. He kept three studio managers aligned without letting rollout pressure leak into delivery chaos.',
    weight: 1.5,
    createdOffsetDays: 72,
  },
  {
    id: '6f777777-7777-4777-8777-777777777777',
    projectKey: 'harborReferralAnalytics',
    reviewer: 'automationFreelancer',
    target: 'broker',
    rating: 4,
    comment:
      'Working with Minh was structured and efficient. He gave fast clarifications, kept approvals moving, and escalated analytics questions before they became blockers.',
    weight: 1.5,
    createdOffsetDays: 19,
  },
];

const WORKSPACE_READY_PROJECT_KEYS: ProjectKey[] = [
  'bookingRefresh',
  'memberPortal',
  'operationsDashboard',
  'loyaltyMicrosite',
  'staffEnablementHub',
];

function buildSeedUuid(prefix: string, projectIndex: number, secondary = 0, tertiary = 0): string {
  const firstGroup = `${prefix}${projectIndex}${secondary}${tertiary}`.padEnd(8, '0').slice(0, 8);
  return `${firstGroup}-0000-4000-8000-000000000000`;
}

function buildContractMilestoneKey(projectIndex: number, milestoneSortOrder: number) {
  return `seed-contract-${projectIndex}-m${milestoneSortOrder}`;
}

function buildSeedContractRecord(
  fixture: ProjectFixture,
  projectIndex: number,
  clientId: string,
  brokerId: string,
  freelancerId: string,
  createdBy: string,
  now: Date,
): SeedContractRecord {
  const activatedAt = daysAgo(now, fixture.endOffsetDays, 17).toISOString();
  const milestoneSnapshot = fixture.milestones.map((milestone) => ({
    contractMilestoneKey: buildContractMilestoneKey(projectIndex, milestone.sortOrder),
    sourceSpecMilestoneId: milestone.id,
    title: milestone.title,
    description: milestone.description,
    amount: milestone.amount,
    startDate: daysAgo(now, milestone.startOffsetDays, 9).toISOString(),
    dueDate: daysAgo(now, milestone.dueOffsetDays, 9).toISOString(),
    sortOrder: milestone.sortOrder,
    deliverableType: milestone.deliverableType,
    retentionAmount: milestone.retentionAmount,
    acceptanceCriteria: milestone.acceptanceCriteria,
    projectMilestoneId: milestone.id,
  }));

  return {
    id: buildSeedUuid('c', projectIndex),
    title: `${fixture.title} Delivery Agreement`,
    contractUrl: `https://contracts.example.local/demo/${fixture.projectId}`,
    termsContent: [
      `Delivery agreement for ${fixture.title}.`,
      'The freelancer delivered all agreed milestones, the broker confirmed completion, and the client approved final release.',
      'Escrow was fully funded before review and released after milestone acceptance.',
      'This contract snapshot is seeded for UI walkthroughs and demo evidence.',
    ].join(' '),
    contentHash: `demo-contract-${fixture.projectId}`,
    activatedAt,
    verifiedAt: activatedAt,
    milestoneSnapshot,
    commercialContext: {
      sourceSpecId: fixture.specId,
      sourceSpecUpdatedAt: daysAgo(now, fixture.updatedOffsetDays, 12).toISOString(),
      requestId: fixture.requestId,
      projectTitle: fixture.title,
      clientId,
      brokerId,
      freelancerId,
      totalBudget: fixture.totalBudget,
      currency: BASE_CURRENCY,
      description: fixture.description,
      techStack: fixture.techPreferences,
      scopeNarrativePlainText: fixture.description,
      features: fixture.featureSeed.map((feature) => ({
        title: feature.title,
        description: feature.description,
        complexity: feature.complexity,
        acceptanceCriteria: feature.acceptanceCriteria,
        inputOutputSpec: null,
      })),
      escrowSplit: { ...PLATFORM_SPLIT },
    },
  };
}

function buildMilestoneTaskSeeds(
  fixture: ProjectFixture,
  milestone: ProjectFixture['milestones'][number],
  projectIndex: number,
  reviewerName: string,
  now: Date,
): SeedTaskRecord[] {
  const milestoneStart = daysAgo(now, milestone.startOffsetDays, 9).toISOString();
  const milestoneDue = daysAgo(now, milestone.dueOffsetDays, 9).toISOString();
  const milestoneSubmitted = daysAgo(now, Math.max(milestone.dueOffsetDays - 1, 1), 15).toISOString();
  const acceptanceSummary =
    milestone.acceptanceCriteria[0] ??
    `Complete the approved deliverable package for ${milestone.title}.`;
  const validationSummary =
    milestone.acceptanceCriteria[1] ??
    `Confirm the client can review and accept ${milestone.title} without follow-up fixes.`;

  return [
    {
      id: buildSeedUuid('d', projectIndex, milestone.sortOrder, 1),
      title: `${milestone.title} handoff package`,
      description: `${acceptanceSummary} This task represents the final implementation and delivery package for ${fixture.title}.`,
      dueDate: milestoneDue,
      sortOrder: 1,
      submissionNote: `Submitted the final handoff package for ${milestone.title}, including implementation notes and launch-ready evidence.`,
      proofLink: `https://deliverables.example.local/projects/${fixture.projectId}/milestones/${milestone.id}/handoff`,
      submittedAt: milestoneSubmitted,
      priority: 'HIGH',
      storyPoints: 5,
      startDate: milestoneStart,
      labels: ['handoff', 'accepted', 'demo-fixture'],
    },
    {
      id: buildSeedUuid('e', projectIndex, milestone.sortOrder, 2),
      title: `${milestone.title} approval checklist`,
      description: `${validationSummary} The seeded record shows a completed broker review and client approval for the same milestone.`,
      dueDate: milestoneDue,
      sortOrder: 2,
      submissionNote: `Broker ${reviewerName} confirmed that the acceptance checklist for ${milestone.title} was complete and ready for client approval.`,
      proofLink: `https://deliverables.example.local/projects/${fixture.projectId}/milestones/${milestone.id}/approval-checklist`,
      submittedAt: milestoneSubmitted,
      priority: 'MEDIUM',
      storyPoints: 3,
      startDate: milestoneStart,
      labels: ['checklist', 'broker-reviewed', 'demo-fixture'],
    },
  ];
}

function daysAgo(baseDate: Date, days: number, hour = 10): Date {
  const value = new Date(baseDate);
  value.setUTCDate(value.getUTCDate() - days);
  value.setUTCHours(hour, 0, 0, 0);
  return value;
}

function log(message: string) {
  console.log(`[feedback-review-seed] ${message}`);
}

type SqlRunner = {
  query: (query: string, parameters?: unknown[]) => Promise<unknown[]>;
};

async function ensureUser(
  manager: SqlRunner,
  config: {
    preferredId: string;
    email: string;
    fullName: string;
    role: 'CLIENT' | 'BROKER' | 'FREELANCER';
    passwordHash: string;
  },
): Promise<string> {
  const existingRows = (await manager.query(`select id from users where email = $1 limit 1`, [
    config.email,
  ])) as Array<{ id: string }>;
  const id = existingRows[0]?.id ?? config.preferredId;

  await manager.query(
    `
      insert into users (
        id,
        email,
        "passwordHash",
        "fullName",
        role,
        "timeZone",
        "isVerified",
        "emailVerifiedAt",
        "termsAcceptedAt",
        "privacyAcceptedAt",
        "currentTrustScore",
        "totalProjectsFinished",
        "totalProjectsCancelled",
        "totalDisputesLost",
        "totalLateProjects",
        status,
        "isBanned",
        "banReason",
        "bannedAt",
        "bannedBy",
        "deletedAt",
        "deletedReason",
        "createdAt",
        "updatedAt"
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        'Asia/Saigon',
        true,
        now(),
        now(),
        now(),
        0,
        0,
        0,
        0,
        0,
        'ACTIVE',
        false,
        null,
        null,
        null,
        null,
        null,
        now(),
        now()
      )
      on conflict (email)
      do update set
        "passwordHash" = excluded."passwordHash",
        "fullName" = excluded."fullName",
        role = excluded.role,
        "timeZone" = excluded."timeZone",
        "isVerified" = true,
        "emailVerifiedAt" = coalesce(users."emailVerifiedAt", excluded."emailVerifiedAt"),
        "termsAcceptedAt" = coalesce(users."termsAcceptedAt", excluded."termsAcceptedAt"),
        "privacyAcceptedAt" = coalesce(users."privacyAcceptedAt", excluded."privacyAcceptedAt"),
        status = 'ACTIVE',
        "isBanned" = false,
        "banReason" = null,
        "bannedAt" = null,
        "bannedBy" = null,
        "deletedAt" = null,
        "deletedReason" = null,
        "updatedAt" = now()
    `,
    [id, config.email, config.passwordHash, config.fullName, config.role],
  );

  return id;
}

async function replaceProfile(
  manager: SqlRunner,
  profileId: string,
  userId: string,
  seed: Pick<ActorSeedConfig, 'bio' | 'companyName' | 'skills' | 'avatarUrl'>,
) {
  await manager.query(`delete from profiles where "userId" = $1`, [userId]);
  await manager.query(
    `
      insert into profiles (
        id,
        "userId",
        "avatarUrl",
        bio,
        "companyName",
        skills,
        "portfolioLinks",
        "linkedinUrl",
        "cvUrl",
        "bankInfo"
      )
      values ($1, $2, $3, $4, $5, $6::text[], null, null, null, null)
    `,
    [profileId, userId, seed.avatarUrl, seed.bio, seed.companyName, seed.skills],
  );
}

async function ensureWallet(manager: SqlRunner, walletId: string, userId: string) {
  const rows = (await manager.query(`select id from wallets where "userId" = $1 limit 1`, [
    userId,
  ])) as Array<{ id: string }>;

  if (rows[0]?.id) {
    await manager.query(
      `
        update wallets
        set currency = $2, status = 'ACTIVE', "updatedAt" = now()
        where id = $1
      `,
      [rows[0].id, BASE_CURRENCY],
    );
    return rows[0].id;
  }

  await manager.query(
    `
      insert into wallets (
        id,
        "userId",
        balance,
        "pendingBalance",
        "heldBalance",
        "totalDeposited",
        "totalWithdrawn",
        "totalEarned",
        "totalSpent",
        currency,
        status,
        "createdAt",
        "updatedAt"
      )
      values ($1, $2, 0, 0, 0, 0, 0, 0, 0, $3, 'ACTIVE', now(), now())
    `,
    [walletId, userId, BASE_CURRENCY],
  );
  return walletId;
}

async function ensureCategory(manager: SqlRunner, preferredId: string, name: string, slug: string) {
  const rows = (await manager.query(
    `select id from project_categories where slug = $1 limit 1`,
    [slug],
  )) as Array<{ id: string }>;
  const id = rows[0]?.id ?? preferredId;

  await manager.query(
    `
      insert into project_categories (id, name, slug, "createdAt")
      values ($1, $2, $3, now())
      on conflict (slug)
      do update set
        name = excluded.name
    `,
    [id, name, slug],
  );

  return id;
}

function buildProjectRequestFeatures(fixture: ProjectFixture) {
  return fixture.featureSeed.map((feature) => ({
    id: feature.id,
    title: feature.title,
    description: feature.description,
    priority: feature.priority,
  }));
}

function buildSpecFeatures(fixture: ProjectFixture) {
  return fixture.featureSeed.map((feature) => ({
    id: feature.id,
    title: feature.title,
    description: feature.description,
    complexity: feature.complexity,
    acceptanceCriteria: feature.acceptanceCriteria,
    inputOutputSpec: null,
    approvedClientFeatureIds: null,
  }));
}

async function seedFeedbackReviewGuideFixtures() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  const now = new Date();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const manager = queryRunner.manager;
    const resolvedMainActors = new Map<MainActorKey, ResolvedActor>();
    const resolvedActors = new Map<ActorKey, ResolvedActor>();

    for (const actor of MAIN_ACTORS) {
      const id = await ensureUser(manager, {
        preferredId: actor.preferredId,
        email: actor.email,
        fullName: actor.fullName,
        role: actor.role,
        passwordHash,
      });
      resolvedMainActors.set(actor.key, {
        key: actor.key,
        id,
        email: actor.email,
        fullName: actor.fullName,
        role: actor.role,
      });
      resolvedActors.set(actor.key, {
        key: actor.key,
        id,
        email: actor.email,
        fullName: actor.fullName,
        role: actor.role,
      });
    }

    for (const actor of SUPPORTING_ACTORS) {
      const id = await ensureUser(manager, {
        preferredId: actor.preferredId,
        email: actor.email,
        fullName: actor.fullName,
        role: actor.role,
        passwordHash,
      });
      resolvedActors.set(actor.key, {
        key: actor.key,
        id,
        email: actor.email,
        fullName: actor.fullName,
        role: actor.role,
      });
    }

    const archiveActorIds = new Map<MainActorKey, string>();
    const archiveKeyByRole: Record<ArchiveActorSeedConfig['role'], MainActorKey> = {
      CLIENT: 'client',
      BROKER: 'broker',
      FREELANCER: 'freelancer',
    };

    for (const archiveActor of ARCHIVE_ACTORS) {
      const id = await ensureUser(manager, {
        preferredId: archiveActor.preferredId,
        email: archiveActor.email,
        fullName: archiveActor.fullName,
        role: archiveActor.role,
        passwordHash,
      });
      archiveActorIds.set(archiveKeyByRole[archiveActor.role], id);
    }

    const mainActorIds = MAIN_ACTORS.map((actor) => resolvedMainActors.get(actor.key)!.id);
    const curatedProjectIds = PROJECT_FIXTURES.map((fixture) => fixture.projectId);
    const curatedRequestIds = PROJECT_FIXTURES.map((fixture) => fixture.requestId);

    const profileIds: Record<ActorKey, string> = {
      client: '70111111-1111-4111-8111-111111111111',
      broker: '70222222-2222-4222-8222-222222222222',
      freelancer: '70333333-3333-4333-8333-333333333333',
      bookingSpecialist: '70444444-4444-4444-8444-444444444444',
      growthClient: '70555555-5555-4555-8555-555555555555',
      opsClient: '70666666-6666-4666-8666-666666666666',
      automationFreelancer: '70777777-7777-4777-8777-777777777777',
      supportBroker: '70888888-8888-4888-8888-888888888888',
    };
    const walletIds: Record<ActorKey, string> = {
      client: '71111111-1111-4111-8111-111111111111',
      broker: '71222222-2222-4222-8222-222222222222',
      freelancer: '71333333-3333-4333-8333-333333333333',
      bookingSpecialist: '71444444-4444-4444-8444-444444444444',
      growthClient: '71555555-5555-4555-8555-555555555555',
      opsClient: '71666666-6666-4666-8666-666666666666',
      automationFreelancer: '71777777-7777-4777-8777-777777777777',
      supportBroker: '71888888-8888-4888-8888-888888888888',
    };
    const categoryPreferredIds: Record<ProjectKey, string> = {
      bookingRefresh: '72111111-1111-4111-8111-111111111111',
      memberPortal: '72222222-2222-4222-8222-222222222222',
      operationsDashboard: '72333333-3333-4333-8333-333333333333',
      loyaltyMicrosite: '72444444-4444-4444-8444-444444444444',
      cedarSaltMigration: '72555555-5555-4555-8555-555555555555',
      meridianAutomation: '72666666-6666-4666-8666-666666666666',
      harborReferralAnalytics: '72777777-7777-4777-8777-777777777777',
      staffEnablementHub: '72888888-8888-4888-8888-888888888888',
    };

    for (const actor of [...MAIN_ACTORS, ...SUPPORTING_ACTORS]) {
      const resolvedActor = resolvedActors.get(actor.key)!;
      await replaceProfile(manager, profileIds[actor.key], resolvedActor.id, actor);
      await ensureWallet(manager, walletIds[actor.key], resolvedActor.id);
    }

    await manager.query(
      `
        delete from reports
        where "reporter_id" = any($1::uuid[])
           or "review_id" in (
             select id
             from reviews
             where "reviewerId" = any($1::uuid[])
                or "targetUserId" = any($1::uuid[])
           )
      `,
      [mainActorIds],
    );

    await manager.query(
      `
        delete from reviews
        where "reviewerId" = any($1::uuid[])
           or "targetUserId" = any($1::uuid[])
      `,
      [mainActorIds],
    );

    await manager.query(`delete from trust_score_history where "userId" = any($1::uuid[])`, [
      mainActorIds,
    ]);

    await manager.query(
      `
        update users
        set
          "totalProjectsFinished" = 0,
          "totalProjectsCancelled" = 0,
          "totalDisputesLost" = 0,
          "totalLateProjects" = 0,
          "currentTrustScore" = 0,
          "updatedAt" = now()
        where id = any($1::uuid[])
      `,
      [mainActorIds],
    );

    await manager.query(
      `
        update projects
        set
          "clientId" = case when "clientId" = $1 then $4 else "clientId" end,
          "brokerId" = case when "brokerId" = $2 then $5 else "brokerId" end,
          "freelancerId" = case when "freelancerId" = $3 then $6 else "freelancerId" end,
          "updatedAt" = now()
        where id <> all($7::uuid[])
          and ("clientId" = $1 or "brokerId" = $2 or "freelancerId" = $3)
      `,
      [
        resolvedMainActors.get('client')!.id,
        resolvedMainActors.get('broker')!.id,
        resolvedMainActors.get('freelancer')!.id,
        archiveActorIds.get('client')!,
        archiveActorIds.get('broker')!,
        archiveActorIds.get('freelancer')!,
        curatedProjectIds,
      ],
    );

    await manager.query(
      `
        update project_requests
        set
          "clientId" = case when "clientId" = $1 then $3 else "clientId" end,
          "brokerId" = case when "brokerId" = $2 then $4 else "brokerId" end,
          "updatedAt" = now()
        where id <> all($5::uuid[])
          and ("clientId" = $1 or "brokerId" = $2)
      `,
      [
        resolvedMainActors.get('client')!.id,
        resolvedMainActors.get('broker')!.id,
        archiveActorIds.get('client')!,
        archiveActorIds.get('broker')!,
        curatedRequestIds,
      ],
    );

    await manager.query(
      `
        delete from broker_proposals
        where "brokerId" = $1
          and "requestId" <> all($2::uuid[])
      `,
      [resolvedMainActors.get('broker')!.id, curatedRequestIds],
    );

    await manager.query(
      `
        delete from project_request_proposals
        where ("freelancerId" = $1 or "brokerId" = $2)
          and "requestId" <> all($3::uuid[])
      `,
      [
        resolvedMainActors.get('freelancer')!.id,
        resolvedMainActors.get('broker')!.id,
        curatedRequestIds,
      ],
    );

    await manager.query(
      `
        delete from notifications
        where "userId" = any($1::uuid[])
          and "relatedType" = 'ProjectRequest'
          and "relatedId" is not null
          and "relatedId" <> all($2::text[])
      `,
      [mainActorIds, curatedRequestIds],
    );

    await manager.query(
      `
        delete from task_history
        where "taskId" in (
          select id
          from tasks
          where "projectId" = any($1::uuid[])
        )
      `,
      [curatedProjectIds],
    );

    await manager.query(
      `
        delete from task_comments
        where "taskId" in (
          select id
          from tasks
          where "projectId" = any($1::uuid[])
        )
      `,
      [curatedProjectIds],
    );

    await manager.query(`delete from tasks where "projectId" = any($1::uuid[])`, [curatedProjectIds]);
    await manager.query(`delete from contracts where "projectId" = any($1::uuid[])`, [curatedProjectIds]);

    const categoryIds = new Map<ProjectKey, string>();
    for (const fixture of PROJECT_FIXTURES) {
      const categoryId = await ensureCategory(
        manager,
        categoryPreferredIds[fixture.key],
        fixture.projectCategoryName,
        fixture.projectCategorySlug,
      );
      categoryIds.set(fixture.key, categoryId);
    }

    for (const fixture of PROJECT_FIXTURES) {
      const projectIndex = PROJECT_FIXTURES.findIndex((candidate) => candidate.key === fixture.key) + 1;
      const clientId = resolvedActors.get(fixture.clientActorKey)!.id;
      const brokerId = resolvedActors.get(fixture.brokerActorKey)!.id;
      const freelancerId = resolvedActors.get(fixture.freelancerActorKey)!.id;
      const brokerName = resolvedActors.get(fixture.brokerActorKey)!.fullName;
      const requestCreatedAt = daysAgo(now, fixture.startOffsetDays + 7, 9).toISOString();
      const projectStartDate = daysAgo(now, fixture.startOffsetDays, 9).toISOString();
      const projectEndDate = daysAgo(now, fixture.endOffsetDays, 9).toISOString();
      const projectUpdatedAt = daysAgo(now, fixture.updatedOffsetDays, 12).toISOString();
      const requestFeatures = buildProjectRequestFeatures(fixture);
      const specFeatures = buildSpecFeatures(fixture);
      const categoryId = categoryIds.get(fixture.key)!;

      await manager.query(
        `
          insert into project_requests (
            id,
            "clientId",
            title,
            description,
            "budgetRange",
            "intendedTimeline",
            "requestedDeadline",
            "techPreferences",
            "commercialBaseline",
            status,
            "brokerId",
            "createdAt",
            "updatedAt"
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9::jsonb,
            $10,
            $11,
            $12::timestamp,
            $13::timestamp
          )
          on conflict (id)
          do update set
            "clientId" = excluded."clientId",
            title = excluded.title,
            description = excluded.description,
            "budgetRange" = excluded."budgetRange",
            "intendedTimeline" = excluded."intendedTimeline",
            "requestedDeadline" = excluded."requestedDeadline",
            "techPreferences" = excluded."techPreferences",
            "commercialBaseline" = excluded."commercialBaseline",
            status = excluded.status,
            "brokerId" = excluded."brokerId",
            "updatedAt" = excluded."updatedAt"
        `,
        [
          fixture.requestId,
          clientId,
          fixture.title,
          fixture.description,
          fixture.budgetRange,
          fixture.estimatedTimeline,
          fixture.requestedDeadline,
          fixture.techPreferences,
          JSON.stringify({
            source: 'REQUEST',
            budgetRange: fixture.budgetRange,
            estimatedBudget: fixture.totalBudget,
            estimatedTimeline: fixture.estimatedTimeline,
            clientFeatures: requestFeatures,
          }),
          fixture.requestStatus,
          brokerId,
          requestCreatedAt,
          projectUpdatedAt,
        ],
      );

      await manager.query(
        `
          insert into project_specs (
            id,
            "requestId",
            "specPhase",
            "parentSpecId",
            title,
            description,
            "totalBudget",
            features,
            "clientFeatures",
            "techStack",
            "referenceLinks",
            "estimatedTimeline",
            "projectCategory",
            "richContentJson",
            "submissionVersion",
            "lastSubmittedSnapshot",
            "lastSubmittedDiff",
            "changeSummary",
            "rejectionHistory",
            status,
            "rejectionReason",
            "clientApprovedAt",
            "createdAt",
            "updatedAt"
          )
          values (
            $1,
            $2,
            'FULL_SPEC',
            null,
            $3,
            $4,
            $5,
            $6::jsonb,
            $7::jsonb,
            $8,
            $9::jsonb,
            $10,
            $11,
            null,
            1,
            $12::jsonb,
            null,
            $13,
            null,
            'APPROVED',
            null,
            $14::timestamp,
            $15::timestamp,
            $16::timestamp
          )
          on conflict (id)
          do update set
            "requestId" = excluded."requestId",
            title = excluded.title,
            description = excluded.description,
            "totalBudget" = excluded."totalBudget",
            features = excluded.features,
            "clientFeatures" = excluded."clientFeatures",
            "techStack" = excluded."techStack",
            "referenceLinks" = excluded."referenceLinks",
            "estimatedTimeline" = excluded."estimatedTimeline",
            "projectCategory" = excluded."projectCategory",
            "submissionVersion" = excluded."submissionVersion",
            "lastSubmittedSnapshot" = excluded."lastSubmittedSnapshot",
            "changeSummary" = excluded."changeSummary",
            status = excluded.status,
            "clientApprovedAt" = excluded."clientApprovedAt",
            "updatedAt" = excluded."updatedAt"
        `,
        [
          fixture.specId,
          fixture.requestId,
          `${fixture.title} Specification`,
          fixture.description,
          fixture.totalBudget,
          JSON.stringify(specFeatures),
          JSON.stringify(requestFeatures),
          fixture.techPreferences,
          JSON.stringify([
            {
              label: `${fixture.title} scope board`,
              url: `https://docs.example.local/${fixture.projectId}`,
            },
          ]),
          fixture.estimatedTimeline,
          fixture.projectCategoryName,
          JSON.stringify({
            phase: 'FULL_SPEC',
            title: `${fixture.title} Specification`,
            description: fixture.description,
            totalBudget: fixture.totalBudget,
            projectCategory: fixture.projectCategoryName,
            estimatedTimeline: fixture.estimatedTimeline,
            clientFeatures: requestFeatures,
            features: specFeatures,
            techStack: fixture.techPreferences,
            referenceLinks: [
              {
                label: `${fixture.title} scope board`,
                url: `https://docs.example.local/${fixture.projectId}`,
              },
            ],
            milestones: fixture.milestones.map((milestone) => ({
              title: milestone.title,
              description: milestone.description,
              amount: milestone.amount,
              deliverableType: milestone.deliverableType,
              retentionAmount: milestone.retentionAmount,
              startDate: daysAgo(now, milestone.startOffsetDays, 9).toISOString(),
              dueDate: daysAgo(now, milestone.dueOffsetDays, 9).toISOString(),
              sortOrder: milestone.sortOrder,
              acceptanceCriteria: milestone.acceptanceCriteria,
              approvedClientFeatureIds: null,
            })),
          }),
          'Curated fixture for feedback, report, and rating walkthroughs.',
          projectEndDate,
          requestCreatedAt,
          projectUpdatedAt,
        ],
      );

      await manager.query(
        `
          insert into projects (
            id,
            "requestId",
            "clientId",
            "brokerId",
            "freelancerId",
            "staffId",
            "staffInviteStatus",
            title,
            description,
            "totalBudget",
            currency,
            "pricingModel",
            "startDate",
            "endDate",
            status,
            "createdAt",
            "updatedAt"
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            null,
            null,
            $6,
            $7,
            $8,
            $9,
            'FIXED_PRICE',
            $10::timestamp,
            $11::timestamp,
            $12,
            $13::timestamp,
            $14::timestamp
          )
          on conflict (id)
          do update set
            "requestId" = excluded."requestId",
            "clientId" = excluded."clientId",
            "brokerId" = excluded."brokerId",
            "freelancerId" = excluded."freelancerId",
            title = excluded.title,
            description = excluded.description,
            "totalBudget" = excluded."totalBudget",
            currency = excluded.currency,
            "pricingModel" = excluded."pricingModel",
            "startDate" = excluded."startDate",
            "endDate" = excluded."endDate",
            status = excluded.status,
            "updatedAt" = excluded."updatedAt"
        `,
        [
          fixture.projectId,
          fixture.requestId,
          clientId,
          brokerId,
          freelancerId,
          fixture.title,
          fixture.description,
          fixture.totalBudget,
          BASE_CURRENCY,
          projectStartDate,
          projectEndDate,
          fixture.projectStatus,
          requestCreatedAt,
          projectUpdatedAt,
        ],
      );

      await manager.query(`delete from project_category_map where project_id = $1`, [fixture.projectId]);
      await manager.query(
        `
          insert into project_category_map (project_id, category_id)
          values ($1, $2)
          on conflict do nothing
        `,
        [fixture.projectId, categoryId],
      );

      for (const milestone of fixture.milestones) {
        const milestoneStart = daysAgo(now, milestone.startOffsetDays, 9).toISOString();
        const milestoneDue = daysAgo(now, milestone.dueOffsetDays, 9).toISOString();
        const milestoneSubmitted =
          milestone.status === 'PAID' || milestone.status === 'COMPLETED'
            ? daysAgo(now, Math.max(milestone.dueOffsetDays - 1, 1), 15).toISOString()
            : null;

        await manager.query(
          `
            insert into milestones (
              id,
              "projectId",
              title,
              description,
              amount,
              "deliverableType",
              "retentionAmount",
              "acceptanceCriteria",
              "approvedClientFeatureIds",
              "projectSpecId",
              "startDate",
              "dueDate",
              status,
              "submittedAt",
              "proofOfWork",
              "videoDemoUrl",
              feedback,
              "reviewedByStaffId",
              "staffRecommendation",
              "staffReviewNote",
              "sortOrder",
              "sourceContractMilestoneKey",
              "createdAt"
            )
            values (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8::jsonb,
              null,
              $9,
              $10::timestamp,
              $11::timestamp,
              $12,
              $13::timestamp,
              $14,
              $15,
              $16,
              $17,
              'ACCEPT',
              $18,
              $19,
              $20,
              $21::timestamp
            )
            on conflict (id)
            do update set
              "projectId" = excluded."projectId",
              title = excluded.title,
              description = excluded.description,
              amount = excluded.amount,
              "deliverableType" = excluded."deliverableType",
              "retentionAmount" = excluded."retentionAmount",
              "acceptanceCriteria" = excluded."acceptanceCriteria",
              "projectSpecId" = excluded."projectSpecId",
              "startDate" = excluded."startDate",
              "dueDate" = excluded."dueDate",
              status = excluded.status,
              "submittedAt" = excluded."submittedAt",
              "proofOfWork" = excluded."proofOfWork",
              "videoDemoUrl" = excluded."videoDemoUrl",
              feedback = excluded.feedback,
              "reviewedByStaffId" = excluded."reviewedByStaffId",
              "staffRecommendation" = excluded."staffRecommendation",
              "staffReviewNote" = excluded."staffReviewNote",
              "sortOrder" = excluded."sortOrder",
              "sourceContractMilestoneKey" = excluded."sourceContractMilestoneKey"
          `,
          [
            milestone.id,
            fixture.projectId,
            milestone.title,
            milestone.description,
            milestone.amount,
            milestone.deliverableType,
            milestone.retentionAmount,
            JSON.stringify(milestone.acceptanceCriteria),
            fixture.specId,
            milestoneStart,
            milestoneDue,
            milestone.status,
            milestoneSubmitted,
            `https://deliverables.example.local/projects/${fixture.projectId}/milestones/${milestone.id}/proof-of-work`,
            `https://videos.example.local/projects/${fixture.projectId}/milestones/${milestone.id}/walkthrough`,
            `Client acceptance completed for ${milestone.title}.`,
            brokerId,
            `${brokerName} completed the broker review checklist and confirmed the deliverables were ready for final approval.`,
            milestone.sortOrder,
            buildContractMilestoneKey(projectIndex, milestone.sortOrder),
            requestCreatedAt,
          ],
        );

        if (milestone.escrowId) {
          const clientWalletId = await ensureWallet(
            manager,
            walletIds[fixture.clientActorKey],
            clientId,
          );
          const brokerWalletId = await ensureWallet(
            manager,
            walletIds[fixture.brokerActorKey],
            brokerId,
          );
          const freelancerWalletId = await ensureWallet(
            manager,
            walletIds[fixture.freelancerActorKey],
            freelancerId,
          );
          const developerShare = Number((milestone.amount * 0.85).toFixed(2));
          const brokerShare = Number((milestone.amount * 0.1).toFixed(2));
          const platformFee = Number((milestone.amount * 0.05).toFixed(2));

          await manager.query(
            `
              insert into escrows (
                id,
                "projectId",
                "milestoneId",
                "totalAmount",
                "fundedAmount",
                "releasedAmount",
                "developerShare",
                "brokerShare",
                "platformFee",
                "developerPercentage",
                "brokerPercentage",
                "platformPercentage",
                currency,
                status,
                "fundedAt",
                "releasedAt",
                "refundedAt",
                "clientApproved",
                "clientApprovedAt",
                "clientWalletId",
                "developerWalletId",
                "brokerWalletId",
                "holdTransactionId",
                "releaseTransactionIds",
                "refundTransactionId",
                "disputeId",
                notes,
                "createdAt",
                "updatedAt"
              )
              values (
                $1,
                $2,
                $3,
                $4,
                $4,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                'RELEASED',
                $12::timestamp,
                $13::timestamp,
                null,
                true,
                $13::timestamp,
                $14,
                $15,
                $16,
                null,
                null,
                null,
                null,
                $17,
                $18::timestamp,
                $19::timestamp
              )
              on conflict (id)
              do update set
                "projectId" = excluded."projectId",
                "milestoneId" = excluded."milestoneId",
                "totalAmount" = excluded."totalAmount",
                "fundedAmount" = excluded."fundedAmount",
                "releasedAmount" = excluded."releasedAmount",
                "developerShare" = excluded."developerShare",
                "brokerShare" = excluded."brokerShare",
                "platformFee" = excluded."platformFee",
                "developerPercentage" = excluded."developerPercentage",
                "brokerPercentage" = excluded."brokerPercentage",
                "platformPercentage" = excluded."platformPercentage",
                currency = excluded.currency,
                status = excluded.status,
                "fundedAt" = excluded."fundedAt",
                "releasedAt" = excluded."releasedAt",
                "clientApproved" = excluded."clientApproved",
                "clientApprovedAt" = excluded."clientApprovedAt",
                "clientWalletId" = excluded."clientWalletId",
                "developerWalletId" = excluded."developerWalletId",
                "brokerWalletId" = excluded."brokerWalletId",
                notes = excluded.notes,
                "updatedAt" = excluded."updatedAt"
            `,
            [
              milestone.escrowId,
              fixture.projectId,
              milestone.id,
              milestone.amount,
              developerShare,
              brokerShare,
              platformFee,
              PLATFORM_SPLIT.developerPercentage,
              PLATFORM_SPLIT.brokerPercentage,
              PLATFORM_SPLIT.platformPercentage,
              BASE_CURRENCY,
              daysAgo(now, milestone.dueOffsetDays + 2, 10).toISOString(),
              daysAgo(now, milestone.dueOffsetDays, 16).toISOString(),
              clientWalletId,
              freelancerWalletId,
              brokerWalletId,
              `Curated closed escrow for ${fixture.title} / ${milestone.title}.`,
              requestCreatedAt,
              projectUpdatedAt,
            ],
          );
        }

        if (WORKSPACE_READY_PROJECT_KEYS.includes(fixture.key)) {
          const milestoneTasks = buildMilestoneTaskSeeds(
            fixture,
            milestone,
            projectIndex,
            brokerName,
            now,
          );

          for (const task of milestoneTasks) {
            await manager.query(
              `
                insert into tasks (
                  id,
                  "milestoneId",
                  "projectId",
                  "parentTaskId",
                  title,
                  description,
                  status,
                  "assignedTo",
                  "dueDate",
                  "sortOrder",
                  "submission_note",
                  "proof_link",
                  "submitted_at",
                  "reporterId",
                  priority,
                  "storyPoints",
                  "startDate",
                  labels,
                  "createdAt"
                )
                values (
                  $1,
                  $2,
                  $3,
                  null,
                  $4,
                  $5,
                  'DONE',
                  $6,
                  $7::timestamp,
                  $8,
                  $9,
                  $10,
                  $11::timestamp,
                  $12,
                  $13,
                  $14,
                  $15::timestamp,
                  $16,
                  $17::timestamp
                )
                on conflict (id)
                do update set
                  "milestoneId" = excluded."milestoneId",
                  "projectId" = excluded."projectId",
                  title = excluded.title,
                  description = excluded.description,
                  status = excluded.status,
                  "assignedTo" = excluded."assignedTo",
                  "dueDate" = excluded."dueDate",
                  "sortOrder" = excluded."sortOrder",
                  "submission_note" = excluded."submission_note",
                  "proof_link" = excluded."proof_link",
                  "submitted_at" = excluded."submitted_at",
                  "reporterId" = excluded."reporterId",
                  priority = excluded.priority,
                  "storyPoints" = excluded."storyPoints",
                  "startDate" = excluded."startDate",
                  labels = excluded.labels
              `,
              [
                task.id,
                milestone.id,
                fixture.projectId,
                task.title,
                task.description,
                freelancerId,
                task.dueDate,
                task.sortOrder,
                task.submissionNote,
                task.proofLink,
                task.submittedAt,
                brokerId,
                task.priority,
                task.storyPoints,
                task.startDate,
                task.labels.join(','),
                requestCreatedAt,
              ],
            );
          }
        }
      }

      if (WORKSPACE_READY_PROJECT_KEYS.includes(fixture.key)) {
        const contract = buildSeedContractRecord(
          fixture,
          projectIndex,
          clientId,
          brokerId,
          freelancerId,
          brokerId,
          now,
        );

        await manager.query(
          `
            insert into contracts (
              id,
              "projectId",
              "sourceSpecId",
              title,
              "contractUrl",
              "archiveStoragePath",
              "archivePersistedAt",
              "archiveDocumentHash",
              "termsContent",
              "contentHash",
              status,
              "legalSignatureStatus",
              provider,
              "verifiedAt",
              "certificateSerial",
              "legalSignatureEvidence",
              "activatedAt",
              "commercialContext",
              "milestoneSnapshot",
              "createdBy",
              "createdAt"
            )
            values (
              $1,
              $2,
              $3,
              $4,
              $5,
              null,
              null,
              null,
              $6,
              $7,
              'ACTIVATED',
              'VERIFIED',
              'DEMO',
              $8::timestamp,
              $9,
              $10::jsonb,
              $11::timestamp,
              $12::jsonb,
              $13::jsonb,
              $14,
              $15::timestamp
            )
            on conflict (id)
            do update set
              "projectId" = excluded."projectId",
              "sourceSpecId" = excluded."sourceSpecId",
              title = excluded.title,
              "contractUrl" = excluded."contractUrl",
              "termsContent" = excluded."termsContent",
              "contentHash" = excluded."contentHash",
              status = excluded.status,
              "legalSignatureStatus" = excluded."legalSignatureStatus",
              provider = excluded.provider,
              "verifiedAt" = excluded."verifiedAt",
              "certificateSerial" = excluded."certificateSerial",
              "legalSignatureEvidence" = excluded."legalSignatureEvidence",
              "activatedAt" = excluded."activatedAt",
              "commercialContext" = excluded."commercialContext",
              "milestoneSnapshot" = excluded."milestoneSnapshot",
              "createdBy" = excluded."createdBy"
          `,
          [
            contract.id,
            fixture.projectId,
            fixture.specId,
            contract.title,
            contract.contractUrl,
            contract.termsContent,
            contract.contentHash,
            contract.verifiedAt,
            `CERT-${fixture.projectId.slice(0, 8).toUpperCase()}`,
            JSON.stringify({
              provider: 'DEMO',
              verificationStatus: 'VERIFIED',
              verifiedBy: brokerId,
            }),
            contract.activatedAt,
            JSON.stringify(contract.commercialContext),
            JSON.stringify(contract.milestoneSnapshot),
            brokerId,
            requestCreatedAt,
          ],
        );
      }
    }

    for (const review of REVIEW_FIXTURES) {
      const project = PROJECT_FIXTURES.find((fixture) => fixture.key === review.projectKey)!;
      const reviewerId = resolvedActors.get(review.reviewer)!.id;
      const targetUserId = resolvedActors.get(review.target)!.id;
      const createdAt = daysAgo(now, review.createdOffsetDays, 11).toISOString();

      await manager.query(
        `
          insert into reviews (
            id,
            "projectId",
            "reviewerId",
            "targetUserId",
            rating,
            comment,
            weight,
            "createdAt",
            "updatedAt",
            "deleted_at",
            "deleted_by",
            "delete_reason",
            "opened_by_id",
            "current_assignee_id",
            "last_assigned_by_id",
            "last_assigned_at",
            "assignment_version"
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8::timestamp,
            $8::timestamp,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            0
          )
          on conflict (id)
          do update set
            "projectId" = excluded."projectId",
            "reviewerId" = excluded."reviewerId",
            "targetUserId" = excluded."targetUserId",
            rating = excluded.rating,
            comment = excluded.comment,
            weight = excluded.weight,
            "createdAt" = excluded."createdAt",
            "updatedAt" = excluded."updatedAt",
            "deleted_at" = null,
            "deleted_by" = null,
            "delete_reason" = null,
            "opened_by_id" = null,
            "current_assignee_id" = null,
            "last_assigned_by_id" = null,
            "last_assigned_at" = null,
            "assignment_version" = 0
        `,
        [
          review.id,
          project.projectId,
          reviewerId,
          targetUserId,
          review.rating,
          review.comment,
          review.weight,
          createdAt,
        ],
      );
    }

    for (const actor of [...MAIN_ACTORS, ...SUPPORTING_ACTORS]) {
      const resolvedActor = resolvedActors.get(actor.key)!;
      const projectCountRows = (await manager.query(
        `
          select count(*)::int as finished
          from projects
          where status in ('PAID', 'COMPLETED')
            and (
              "clientId" = $1
              or "brokerId" = $1
              or "freelancerId" = $1
            )
        `,
        [resolvedActor.id],
      )) as Array<{ finished: number }>;
      const finishedCount = Number(projectCountRows[0]?.finished ?? 0);
      await manager.query(
        `
          update users
          set
            "totalProjectsFinished" = $2,
            "totalProjectsCancelled" = $3,
            "totalDisputesLost" = $4,
            "totalLateProjects" = $5,
            "updatedAt" = now()
          where id = $1
        `,
        [
          resolvedActor.id,
          finishedCount,
          0,
          0,
          0,
        ],
      );
    }

    const trustScoreService = new TrustScoreService(
      manager.getRepository(UserEntity),
      manager.getRepository(ReviewEntity),
      manager.getRepository(TrustScoreHistoryEntity),
    );

    for (const actor of MAIN_ACTORS) {
      const resolvedActor = resolvedMainActors.get(actor.key)!;
      await trustScoreService.calculateTrustScore(resolvedActor.id);
    }

    await queryRunner.commitTransaction();

    return {
      password: DEMO_PASSWORD,
      actors: MAIN_ACTORS.map((actor) => {
        const resolvedActor = resolvedMainActors.get(actor.key)!;
        return {
          role: actor.role,
          email: resolvedActor.email,
          fullName: actor.fullName,
          userId: resolvedActor.id,
        };
      }),
      projects: PROJECT_FIXTURES.map((fixture) => ({
        id: fixture.projectId,
        title: fixture.title,
        status: fixture.projectStatus,
        latestReviewOpportunity: fixture.key === 'loyaltyMicrosite',
      })),
      reviews: REVIEW_FIXTURES.map((review) => ({
        reviewId: review.id,
        project: PROJECT_FIXTURES.find((fixture) => fixture.key === review.projectKey)!.title,
        reviewer: resolvedActors.get(review.reviewer)!.email,
        target: resolvedActors.get(review.target)!.email,
        rating: review.rating,
      })),
      reportsSeeded: 0,
      liveDemoMatrix: [
        {
          actor: resolvedMainActors.get('client')!.email,
          canRate: resolvedMainActors.get('freelancer')!.email,
          anchorProject: PROJECT_FIXTURES.find((fixture) => fixture.key === 'loyaltyMicrosite')!.title,
          canReportReviewBy: resolvedMainActors.get('broker')!.email,
        },
        {
          actor: resolvedMainActors.get('broker')!.email,
          canRate: resolvedMainActors.get('client')!.email,
          anchorProject: PROJECT_FIXTURES.find((fixture) => fixture.key === 'loyaltyMicrosite')!.title,
          canReportReviewBy: resolvedMainActors.get('freelancer')!.email,
        },
        {
          actor: resolvedMainActors.get('freelancer')!.email,
          canRate: resolvedMainActors.get('broker')!.email,
          anchorProject: PROJECT_FIXTURES.find((fixture) => fixture.key === 'loyaltyMicrosite')!.title,
          canReportReviewBy: resolvedMainActors.get('client')!.email,
        },
      ],
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  seedFeedbackReviewGuideFixtures()
    .then((manifest) => {
      log('Curated feedback/review demo seed completed.');
      console.log(JSON.stringify(manifest, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

export { seedFeedbackReviewGuideFixtures };
