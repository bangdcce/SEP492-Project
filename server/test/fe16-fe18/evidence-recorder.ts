import * as fs from 'fs';
import * as path from 'path';

export type CaseResult = 'Pass' | 'Fail' | 'Untested' | 'N/A';

export interface EvidenceRecord {
  id: string;
  result: CaseResult;
  actualResults: string;
  evidenceRef: string;
  testDate: string;
  tester: string;
  note: string;
}

const DEFAULT_TESTER = process.env.FE16_FE18_TESTER || 'SonNT';

const resolveEvidenceDir = () =>
  path.resolve(
    __dirname,
    '..',
    '..',
    'test-artifacts',
    'fe16-fe18',
    'evidence',
  );

export const getEvidenceDir = (): string => resolveEvidenceDir();

export const resetEvidenceDirectory = (): void => {
  fs.rmSync(resolveEvidenceDir(), { recursive: true, force: true });
  fs.mkdirSync(resolveEvidenceDir(), { recursive: true });
};

export const recordEvidence = (
  input: Omit<Partial<EvidenceRecord>, 'tester' | 'testDate' | 'result'> & {
    id: string;
    actualResults: string;
    evidenceRef: string;
    result?: CaseResult;
  },
): void => {
  fs.mkdirSync(resolveEvidenceDir(), { recursive: true });

  const payload: EvidenceRecord = {
    id: input.id,
    result: input.result ?? 'Pass',
    actualResults: input.actualResults,
    evidenceRef: input.evidenceRef,
    testDate: new Date().toISOString().slice(0, 10),
    tester: DEFAULT_TESTER,
    note: input.note ?? '',
  };

  fs.writeFileSync(
    path.join(resolveEvidenceDir(), `${input.id}.json`),
    JSON.stringify(payload, null, 2),
    'utf8',
  );
};
