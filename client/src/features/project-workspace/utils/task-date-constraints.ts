const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parseTaskDateValue = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const parsedDate = DATE_ONLY_PATTERN.test(normalizedValue)
    ? (() => {
        const [year, month, day] = normalizedValue.split("-").map(Number);
        return new Date(year, month - 1, day);
      })()
    : new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate;
};

export const formatTaskDateValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const clampTaskDateValue = (
  value: Date,
  minDate?: Date | null,
  maxDate?: Date | null,
) => {
  const nextValue = new Date(value.getTime());
  nextValue.setHours(0, 0, 0, 0);

  if (minDate && nextValue.getTime() < minDate.getTime()) {
    return new Date(minDate.getTime());
  }

  if (maxDate && nextValue.getTime() > maxDate.getTime()) {
    return new Date(maxDate.getTime());
  }

  return nextValue;
};

export const getLaterTaskDate = (left?: Date | null, right?: Date | null) => {
  if (!left) {
    return right ?? null;
  }

  if (!right) {
    return left;
  }

  return left.getTime() >= right.getTime() ? left : right;
};

export const getEarlierTaskDate = (left?: Date | null, right?: Date | null) => {
  if (!left) {
    return right ?? null;
  }

  if (!right) {
    return left;
  }

  return left.getTime() <= right.getTime() ? left : right;
};
