export interface MeterData { voltage: number; frequency: number; power_factor: number; current: number }
export function decodeMeterData(bytes: Uint8Array): MeterData;
