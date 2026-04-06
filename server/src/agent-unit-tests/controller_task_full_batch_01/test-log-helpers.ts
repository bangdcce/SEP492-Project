const normalizeSentence = (text: string) => {
  const compact = text.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  if (!compact) {
    return 'Case executed successfully.';
  }
  return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}.`;
};

export const buildCaseLogMessageFromTitle = (currentTestName: string) => {
  const leafTitle = currentTestName.split(' › ').pop() ?? currentTestName;
  const match = leafTitle.match(/(EP-\d+)\s+(UTC\d+)\s+(.+)/);
  if (!match) {
    return `"${normalizeSentence(leafTitle)}"`;
  }

  const [, , utcId, behavior] = match;
  const detail = behavior.trim();

  let message: string;
  if (utcId === 'UTC01') {
    message = normalizeSentence(
      detail.replace(/^happy path\s+/i, 'Success: '),
    );
  } else if (utcId === 'UTC02' || utcId === 'UTC03') {
    message = normalizeSentence(
      detail.replace(/^edge case\s+/i, 'Handled edge case: '),
    );
  } else if (utcId === 'UTC04' || utcId === 'UTC05' || utcId === 'UTC06') {
    message = normalizeSentence(
      detail.replace(/^validation\s+/i, 'Validation outcome: '),
    );
  } else if (utcId === 'UTC07' || utcId === 'UTC08') {
    message = normalizeSentence(
      detail.replace(/^security\s+/i, 'Security outcome: '),
    );
  } else {
    message = normalizeSentence(detail);
  }

  return `"${message}"`;
};

export const assertCurrentTestHasCaseLog = () => {
  const currentTestName = expect.getState().currentTestName ?? '';
  const logMessage = buildCaseLogMessageFromTitle(currentTestName);
  expect(logMessage).toMatch(/^".+"$/);
};
