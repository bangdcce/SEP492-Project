import type { ClientFeatureDTO } from './types';

export interface ClientSpecTemplate {
  code: string;
  name: string;
  description: string;
  projectCategory: string;
  estimatedTimeline: string;
  clientFeatures: ClientFeatureDTO[];
}

export const CLIENT_SPEC_TEMPLATES: ClientSpecTemplate[] = [
  {
    code: 'ECOMMERCE_STANDARD',
    name: 'E-commerce Standard',
    description: 'Baseline flow for catalog, cart, checkout, and admin product management.',
    projectCategory: 'E_COMMERCE',
    estimatedTimeline: '10-14 weeks',
    clientFeatures: [
      {
        title: 'Product Catalog',
        description: 'Users can browse products with filters, sorting, and category navigation.',
        priority: 'MUST_HAVE',
      },
      {
        title: 'Checkout',
        description: 'Users can place orders with shipping information and payment confirmation.',
        priority: 'MUST_HAVE',
      },
      {
        title: 'Order Tracking',
        description: 'Users can view current order status and delivery updates after purchase.',
        priority: 'SHOULD_HAVE',
      },
    ],
  },
  {
    code: 'SAAS_PORTAL',
    name: 'SaaS Portal',
    description: 'Typical SaaS dashboard with account management and subscription flows.',
    projectCategory: 'SAAS',
    estimatedTimeline: '8-12 weeks',
    clientFeatures: [
      {
        title: 'Workspace Dashboard',
        description: 'Users can see key metrics, activity logs, and shortcuts after login.',
        priority: 'MUST_HAVE',
      },
      {
        title: 'Subscription Management',
        description: 'Users can upgrade plans, manage billing information, and download invoices.',
        priority: 'MUST_HAVE',
      },
      {
        title: 'Team Access',
        description: 'Account owners can invite teammates and control role-based permissions.',
        priority: 'SHOULD_HAVE',
      },
    ],
  },
  {
    code: 'SERVICE_MARKETPLACE',
    name: 'Service Marketplace',
    description: 'Marketplace flow with profile pages, discovery, and booking workflow.',
    projectCategory: 'MARKETPLACE',
    estimatedTimeline: '12-16 weeks',
    clientFeatures: [
      {
        title: 'Provider Discovery',
        description: 'Clients can search providers by category, location, and ratings.',
        priority: 'MUST_HAVE',
      },
      {
        title: 'Booking Requests',
        description: 'Clients can submit booking requests and receive status updates.',
        priority: 'MUST_HAVE',
      },
      {
        title: 'Messaging',
        description: 'Clients and providers can exchange messages around a booking request.',
        priority: 'SHOULD_HAVE',
      },
    ],
  },
];
