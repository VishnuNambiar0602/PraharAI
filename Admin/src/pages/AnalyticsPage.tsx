import { useState, useEffect } from 'react';
import { TrendingUp, Users, FileText, Activity } from 'lucide-react';
import { getAnalytics } from '../api';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      await getAnalytics(Number(timeRange));
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">System usage and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          {(['7', '30', '90'] as const).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === days
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="size-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-success">+12.5%</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">2,543</p>
          <p className="text-sm text-gray-600 mt-1">Total Users</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-green-50 flex items-center justify-center">
              <FileText className="size-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-success">+8.2%</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">4,609</p>
          <p className="text-sm text-gray-600 mt-1">Active Schemes</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-purple-50 flex items-center justify-center">
              <Activity className="size-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-success">+23.1%</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">12,847</p>
          <p className="text-sm text-gray-600 mt-1">Applications</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-orange-50 flex items-center justify-center">
              <TrendingUp className="size-6 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-success">+15.3%</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">89.2%</p>
          <p className="text-sm text-gray-600 mt-1">Success Rate</p>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h2>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">Chart visualization coming soon</p>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Application Trends</h2>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">Chart visualization coming soon</p>
          </div>
        </div>
      </div>

      {/* Popular Schemes */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Popular Schemes</h2>
        <div className="space-y-3">
          {[
            { name: 'PM-KISAN', applications: 1234, growth: 15 },
            { name: 'Ayushman Bharat', applications: 987, growth: 22 },
            { name: 'Pradhan Mantri Awas Yojana', applications: 856, growth: 8 },
            { name: 'National Scholarship Portal', applications: 743, growth: 31 },
            { name: 'MUDRA Loan Scheme', applications: 621, growth: 12 },
          ].map((scheme, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-400">{i + 1}</span>
                <div>
                  <p className="font-medium text-gray-900">{scheme.name}</p>
                  <p className="text-sm text-gray-600">{scheme.applications} applications</p>
                </div>
              </div>
              <span className="text-sm font-medium text-success">+{scheme.growth}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User by State</h2>
          <div className="space-y-3">
            {[
              { state: 'Maharashtra', users: 456, percentage: 18 },
              { state: 'Uttar Pradesh', users: 398, percentage: 16 },
              { state: 'Karnataka', users: 342, percentage: 13 },
              { state: 'Tamil Nadu', users: 289, percentage: 11 },
              { state: 'Gujarat', users: 234, percentage: 9 },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{item.state}</span>
                  <span className="text-sm text-gray-600">{item.users} users</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User by Category</h2>
          <div className="space-y-3">
            {[
              { category: 'Farmers', users: 678, percentage: 27 },
              { category: 'Students', users: 543, percentage: 21 },
              { category: 'Low Income Workers', users: 432, percentage: 17 },
              { category: 'Senior Citizens', users: 321, percentage: 13 },
              { category: 'Women', users: 289, percentage: 11 },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{item.category}</span>
                  <span className="text-sm text-gray-600">{item.users} users</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-success h-2 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
