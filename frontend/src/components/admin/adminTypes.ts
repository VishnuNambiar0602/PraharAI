export interface DashboardStats {
  totalUsers: number;
  totalSchemes: number;
  activeSchemes: number;
  totalApplications: number;
  userGrowth: number;
  schemeGrowth: number;
  applicationGrowth: number;
}

export interface User {
  userId: string;
  email: string;
  name: string;
  age?: number;
  income?: number;
  state?: string;
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

export interface UserGroup {
  groupId: string;
  groupName: string;
  description: string;
  memberCount: number;
  ageRangeMin?: number;
  ageRangeMax?: number;
  incomeRangeMin?: number;
  incomeRangeMax?: number;
}

export interface SyncStatus {
  totalSchemes: number;
  lastSync: string | null;
  nextSync: string | null;
  isSyncing: boolean;
  recentRuns?: Array<{
    runId: string;
    startedAt: string;
    finishedAt: string;
    totalSchemes: number;
    inserted: number;
    updated: number;
    unchanged: number;
    deactivated: number;
    durationSeconds: number;
  }>;
  auditSummary?: {
    runsTracked: number;
    lastRun: {
      runId: string;
      finishedAt: string;
      totalSchemes: number;
      inserted: number;
      updated: number;
      unchanged: number;
      deactivated: number;
      durationSeconds: number;
    } | null;
    recentTotals: {
      inserted: number;
      updated: number;
      unchanged: number;
      deactivated: number;
    };
  };
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

export interface AnalyticsData {
  date: string;
  users: number;
  applications: number;
  schemes: number;
}
