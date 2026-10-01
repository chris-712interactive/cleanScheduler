export type PropertyAccessCodes = {
  gateCode: string;
  doorCode: string;
  garageCode: string;
};

const MAX_CODE_LENGTH = 80;

export function emptyPropertyAccessCodes(): PropertyAccessCodes {
  return { gateCode: '', doorCode: '', garageCode: '' };
}

export function hasPropertyAccessCodes(codes: PropertyAccessCodes): boolean {
  return Boolean(codes.gateCode || codes.doorCode || codes.garageCode);
}

function optionalCode(value: unknown): string {
  if (value == null) return '';
  return String(value).trim().slice(0, MAX_CODE_LENGTH);
}

export function parsePropertyAccessCodesFromForm(formData: FormData): PropertyAccessCodes {
  return {
    gateCode: optionalCode(formData.get('gate_code')),
    doorCode: optionalCode(formData.get('door_code')),
    garageCode: optionalCode(formData.get('garage_code')),
  };
}

export function formatPropertyAccessCodes(codes: PropertyAccessCodes): string | null {
  const lines = [
    codes.gateCode ? `Gate code: ${codes.gateCode}` : '',
    codes.doorCode ? `Door code: ${codes.doorCode}` : '',
    codes.garageCode ? `Garage code: ${codes.garageCode}` : '',
  ].filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : null;
}
