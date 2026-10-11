/**
 * Comprehensive data validation utilities for NRE Fleet Management app.
 * Optimized for Android Chrome, iOS Safari, and Desktop browsers.
 */

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  warning?: string;
}

/**
 * Validates date string in ISO (YYYY-MM-DD) or Brazilian format (DD/MM/YYYY)
 */
export function validateDate(dateStr: string): ValidationResult {
  if (!dateStr || !dateStr.trim()) {
    return { isValid: false, message: 'Data é obrigatória. Selecione uma data válida.' };
  }

  const trimmed = dateStr.trim();
  let year: number;
  let month: number;
  let day: number;

  if (trimmed.includes('-')) {
    // ISO format YYYY-MM-DD
    const parts = trimmed.split('-');
    if (parts.length !== 3) {
      return { isValid: false, message: 'Formato de data inválido. Use AAAA-MM-DD.' };
    }
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else if (trimmed.includes('/')) {
    // Brazilian format DD/MM/YYYY
    const parts = trimmed.split('/');
    if (parts.length !== 3) {
      return { isValid: false, message: 'Formato de data inválido. Use DD/MM/AAAA.' };
    }
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  } else {
    return { isValid: false, message: 'Data inválida.' };
  }

  const parsedDate = new Date(year, month, day);
  if (
    isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month ||
    parsedDate.getDate() !== day
  ) {
    return { isValid: false, message: 'Data do calendário inexistente ou inválida.' };
  }

  const now = new Date();
  const maxFuture = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days in future (timezone tolerance)
  const maxPast = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

  if (parsedDate > maxFuture) {
    return { isValid: false, message: 'A data não pode ser futura além de 2 dias.' };
  }

  if (parsedDate < maxPast) {
    return { isValid: false, message: 'A data informada é anterior a 1 ano atrás.' };
  }

  return { isValid: true };
}

/**
 * Validates time string in HH:MM format
 */
export function validateTime(timeStr: string): ValidationResult {
  if (!timeStr || !timeStr.trim()) {
    return { isValid: false, message: 'Horário é obrigatório. Informe a hora e os minutos.' };
  }

  const trimmed = timeStr.trim();
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (!timeRegex.test(trimmed)) {
    return { isValid: false, message: 'Horário inválido. Use o formato HH:MM (ex: 08:30 ou 14:45).' };
  }

  return { isValid: true };
}

/**
 * Validates vehicle odometer reading (KM)
 * Supports comparison with previous recorded KM (e.g. current vehicle odometer or departure KM)
 */
export function validateKm(
  kmInput: string | number,
  previousKm?: number,
  mode: 'DEPARTURE' | 'ARRIVAL' | 'ADMIN' = 'DEPARTURE'
): ValidationResult {
  if (kmInput === undefined || kmInput === null || kmInput.toString().trim() === '') {
    return { isValid: false, message: 'Quilometragem (KM) é obrigatória. Digite o odômetro do painel.' };
  }

  // Normalize string (remove possible thousand dots or commas)
  const cleanStr = kmInput.toString().replace(/\./g, '').replace(/,/g, '.').trim();
  const num = Number(cleanStr);

  if (isNaN(num)) {
    return { isValid: false, message: 'O valor do odômetro deve ser composto apenas por números.' };
  }

  if (!Number.isFinite(num)) {
    return { isValid: false, message: 'Número de quilometragem inválido.' };
  }

  if (num <= 0) {
    return { isValid: false, message: 'O odômetro deve ser maior que zero (KM positivo).' };
  }

  if (num > 999999) {
    return { isValid: false, message: 'Quilometragem excessiva (máximo 999.999 km).' };
  }

  // Relative checks against previous KM
  if (previousKm !== undefined && previousKm > 0) {
    if (mode === 'ARRIVAL') {
      if (num < previousKm) {
        return {
          isValid: false,
          message: `KM de chegada (${num.toLocaleString('pt-BR')} km) não pode ser menor que o KM de saída (${previousKm.toLocaleString('pt-BR')} km).`,
        };
      }

      const diff = num - previousKm;
      if (diff === 0) {
        return {
          isValid: true,
          warning: 'Atenção: A distância percorrida calculada é de 0 km. Confirme a leitura no painel.',
        };
      }
      if (diff > 2500) {
        return {
          isValid: true,
          warning: `Atenção: Distância percorrida muito alta (${diff.toLocaleString('pt-BR')} km). Verifique se o KM foi digitado corretamente.`,
        };
      }
    } else if (mode === 'DEPARTURE') {
      if (num < previousKm) {
        return {
          isValid: false,
          message: `KM digitado (${num.toLocaleString('pt-BR')} km) é inferior ao último odômetro registrado deste veículo (${previousKm.toLocaleString('pt-BR')} km).`,
        };
      }

      const diff = num - previousKm;
      if (diff > 4000) {
        return {
          isValid: true,
          warning: `Atenção: KM informado está ${diff.toLocaleString('pt-BR')} km acima do registro anterior (${previousKm.toLocaleString('pt-BR')} km). Confirme o painel.`,
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates fuel liters
 * Handles Brazilian keyboard comma decimals (e.g. "45,5" -> 45.5)
 */
export function validateLiters(litersInput: string | number): ValidationResult & { parsedLiters?: number } {
  if (litersInput === undefined || litersInput === null || litersInput.toString().trim() === '') {
    return { isValid: false, message: 'Informe a quantidade de litros abastecidos.' };
  }

  const cleanStr = litersInput.toString().replace(',', '.').trim();
  const num = Number(cleanStr);

  if (isNaN(num)) {
    return { isValid: false, message: 'Quantidade de litros deve ser um número válido (ex: 45.5 ou 50).' };
  }

  if (num <= 0) {
    return { isValid: false, message: 'A quantidade de litros abastecidos deve ser estritamente maior que 0.' };
  }

  if (num > 150) {
    return {
      isValid: false,
      message: `Quantidade de litros (${num} L) excede a capacidade máxima de tanque de um veículo da frota (máx 150 L).`,
    };
  }

  let warning: string | undefined;
  if (num < 1) {
    warning = 'Aviso: Quantidade de combustível inferior a 1 litro.';
  } else if (num > 90) {
    warning = `Aviso: Abastecimento de ${num} L é elevado para veículos de passeio normais.`;
  }

  return { isValid: true, parsedLiters: num, warning };
}

/**
 * Validates required text strings (driver name, visit reason, city, etc.)
 */
export function validateRequiredText(
  value: string,
  fieldName: string,
  minLength: number = 3
): ValidationResult {
  if (!value || !value.trim()) {
    return { isValid: false, message: `O campo ${fieldName} é obrigatório e não pode ficar em branco.` };
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    return {
      isValid: false,
      message: `O campo ${fieldName} deve conter pelo menos ${minLength} caracteres.`,
    };
  }

  return { isValid: true };
}
