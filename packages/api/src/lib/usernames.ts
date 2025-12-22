const MAX_USERNAME_LENGTH = 50;

function normalize(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '');
}

export function buildUsernameBase(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1] : first;

  const firstInitial = normalize(first).slice(0, 1);
  const lastSegment = normalize(last).slice(0, 6);

  const base = `${firstInitial}${lastSegment}`.toLowerCase();
  return base || 'user';
}

export function buildUsernameCandidate(base: string, suffix: number): string {
  const suffixValue = suffix > 0 ? String(suffix) : '';
  const allowedBaseLength = MAX_USERNAME_LENGTH - suffixValue.length;
  const trimmedBase = base.slice(0, Math.max(1, allowedBaseLength));
  return `${trimmedBase}${suffixValue}`;
}
