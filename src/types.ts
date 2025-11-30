export interface GenerationMixItem {
  fuel: string;
  perc: number;
}

export interface GenerationData {
  from: string;
  to: string;
  generationmix: GenerationMixItem[];
}

export interface ApiResponse {
  data: GenerationData[];
}

export interface DailyEnergyMix {
  date: string;
  cleanEnergyPerc: number;
  mix: Record<string, number>;
}

export interface OptimalChargingWindow {
  startTime: string;
  endTime: string;
  cleanEnergyPerc: number;
}

export const CLEAN_ENERGY_SOURCES = [
  'biomass',
  'nuclear',
  'hydro',
  'wind',
  'solar',
];