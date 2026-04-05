export type WorkbookCaseType = 'N' | 'A' | 'B';

export type WorkbookCaseStatus = 'P' | 'F' | 'U';

export type WorkbookCaseDescriptor = {
  utcId: string;
  testKey: string;
  title: string;
  type: WorkbookCaseType;
  preconditions: string[];
  inputs: Record<string, unknown>;
  returns: string[];
  exceptions: string[];
  logs: string[];
  status?: WorkbookCaseStatus;
  executedDate?: string;
  defectId?: string;
};

