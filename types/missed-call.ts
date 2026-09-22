export interface MissedCallRecord {
  id: string;
  digitrackNo: string;
  grower: string;
  date: string;
  dateParsed: Date | null;
  action: string;
  dateProcessed: string;
  division: string;
  state: string;
  zone: string;
  ptName: string;
  ptHeadquarter: string;
  ptDistrict: string;
  ptMobile: string;
  designation: string;
}

export interface PTMappingRecord {
  digitrackNo: string;
  division: string;
  state: string;
  rbhName: string;
  zm: string;
  zone: string;
  tmName: string;
  tmHeadquarter: string;
  tmiCode: string;
  ptName: string;
  ptHeadquarter: string;
  ptDistrict: string;
  ptMobile: string;
  designation: string;
  email: string;
  language: string;
}

export interface MissedCallKPIs {
  totalCalls: number;
  uniqueCalls: number;
  repeatCalls: number;
  repeatRate: number; // percentage
  activeStatesCount: number;
  activePTsCount: number;
  activeZonesCount: number;
}

export interface StateMissedCallMetric {
  state: string;
  totalCalls: number;
  uniqueCalls: number;
  repeatCalls: number;
  ptCount: number;
  percentage: number;
}

export interface PTMissedCallMetric {
  digitrackNo: string;
  ptName: string;
  ptHeadquarter: string;
  ptDistrict: string;
  state: string;
  zone: string;
  division: string;
  ptMobile: string;
  designation: string;
  totalCalls: number;
  uniqueCalls: number;
  repeatCalls: number;
}

export interface MissedCallFilterState {
  search: string;
  state: string;
  zone: string;
  ptName: string;
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
}

export interface MissedCallReportPayload {
  kpis: MissedCallKPIs;
  stateMetrics: StateMissedCallMetric[];
  ptMetrics: PTMissedCallMetric[];
  calls: MissedCallRecord[];
  totalCount: number;
  filterOptions: {
    states: string[];
    zones: string[];
    ptNames: string[];
  };
  lastSyncedAt: string;
}
