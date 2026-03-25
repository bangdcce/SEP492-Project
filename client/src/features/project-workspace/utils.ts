import type { Task, TaskSubmission } from "./types";

export const calculateProgress = (tasks?: Task[] | null): number => {
  if (!tasks || tasks.length === 0) return 0;
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  return Math.round((doneCount / tasks.length) * 100);
};

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractUrls = (html: string): string[] => {
  const urls = new Set<string>();
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const srcRegex = /src=["']([^"']+)["']/gi;

  for (const match of html.matchAll(hrefRegex)) {
    const url = match[1]?.trim();
    if (url) urls.add(url);
  }

  for (const match of html.matchAll(srcRegex)) {
    const url = match[1]?.trim();
    if (url) urls.add(url);
  }

  return Array.from(urls);
};

const sortSubmissionsDescending = (
  left: TaskSubmission,
  right: TaskSubmission
): number => {
  if (left.version !== right.version) {
    return right.version - left.version;
  }

  const leftTime = new Date(
    left.reviewedAt || left.createdAt || 0
  ).getTime();
  const rightTime = new Date(
    right.reviewedAt || right.createdAt || 0
  ).getTime();

  return rightTime - leftTime;
};

export const getLatestApprovedSubmission = (
  task?: Pick<Task, "submissions"> | null
): TaskSubmission | null => {
  const approvedSubmissions =
    task?.submissions?.filter((submission) => submission.status === "APPROVED") ||
    [];

  if (approvedSubmissions.length === 0) {
    return null;
  }

  return [...approvedSubmissions].sort(sortSubmissionsDescending)[0] ?? null;
};

export const getSubmissionEvidenceUrl = (
  submission?: Pick<TaskSubmission, "attachments" | "content"> | null
): string | null => {
  if (!submission) {
    return null;
  }

  const attachmentUrl = submission.attachments?.find(Boolean)?.trim();
  if (attachmentUrl) {
    return attachmentUrl;
  }

  const contentUrl = extractUrls(submission.content).find(Boolean)?.trim();
  return contentUrl || null;
};

export const getSubmissionPreviewText = (
  submission?: Pick<TaskSubmission, "content"> | null,
  maxLength = 140
): string => {
  if (!submission?.content) {
    return "";
  }

  const text = stripHtml(submission.content);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
};
