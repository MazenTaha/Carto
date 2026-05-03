const EGYPTIAN_MOBILE_PATTERN = /^(\+201[0125]\d{8}|01[0125]\d{8})$/;

export function normalizeEgyptianMobileNumber(input: string): string | null {
  const value = input.replace(/[\s().-]/g, '');

  if (!EGYPTIAN_MOBILE_PATTERN.test(value)) {
    return null;
  }

  if (value.startsWith('+20')) {
    return value;
  }

  return `+2${value}`;
}

export function isValidEgyptianMobileNumber(input: string): boolean {
  return normalizeEgyptianMobileNumber(input) !== null;
}
