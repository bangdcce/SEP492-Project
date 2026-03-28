const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const getTodayDateInputValue = (referenceDate: Date = new Date()): string => {
  const year = referenceDate.getFullYear();
  const month = `${referenceDate.getMonth() + 1}`.padStart(2, "0");
  const day = `${referenceDate.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const isPastDateInputValue = (
  value: string,
  minimumDate: string = getTodayDateInputValue(),
): boolean => {
  const normalizedValue = value.trim();

  if (!DATE_INPUT_PATTERN.test(normalizedValue)) {
    return false;
  }

  return normalizedValue < minimumDate;
};
