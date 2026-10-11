/**
 * Date and time utilities formatted for Brasília timezone (America/Sao_Paulo)
 */

export function getBrasiliaDateISO(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  const month = parts.find(p => p.type === 'month')?.value || '08';
  const day = parts.find(p => p.type === 'day')?.value || '11';
  return `${year}-${month}-${day}`;
}

export function getBrasiliaDateFormatted(isoString?: string): string {
  if (isoString && isoString.includes('-')) {
    const [year, month, day] = isoString.split('-');
    return `${day}/${month}/${year}`;
  }
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  return new Intl.DateTimeFormat('pt-BR', options).format(now);
}

export function getBrasiliaTime(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  return new Intl.DateTimeFormat('pt-BR', options).format(now);
}
