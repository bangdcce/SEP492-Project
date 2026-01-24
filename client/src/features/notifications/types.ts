export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  readAt?: string;
  relatedType?: string | null;
  relatedId?: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
}
