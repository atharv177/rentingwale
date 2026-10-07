export function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export function parsePositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return number;
}