export interface PanchayatStats {
  totalBeneficiaries: number;
  totalSchemes: number;
  activeSchemes: number;
  enrollmentsThisMonth: number;
  beneficiaryGrowth: number;
  schemeGrowth: number;
}

export interface Beneficiary {
  userId: string;
  email: string;
  name: string;
  age?: number;
  income?: number;
  state?: string;
  district?: string;
  village?: string;
  employment?: string;
  education?: string;
  gender?: string;
  createdAt: string;
  onboardingComplete?: boolean;
}

export interface Scheme {
  scheme_id: string;
  name: string;
  description: string;
  category: string;
  ministry: string | null;
  state: string | null;
  tags: string;
  is_active: boolean;
  last_updated: string;
  scheme_url: string | null;
}

export interface SyncStatus {
  totalSchemes: number;
  lastSync: string | null;
  nextSync: string | null;
  isSyncing: boolean;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  neo4j: boolean;
  redis: boolean;
  api: boolean;
  timestamp: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  userId?: string;
  userName?: string;
  details: string;
  type: 'user' | 'scheme' | 'system';
}

export interface DistributionEntry {
  label: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  totalUsers: number;
  totalSchemes: number;
  enrichedSchemes: number;
  activeSchemes: number;
  stateDistribution: DistributionEntry[];
  employmentDistribution: DistributionEntry[];
  userGrowthTrend: { month: string; users: number }[];
  schemeSyncTrend: { month: string; schemes: number }[];
}
