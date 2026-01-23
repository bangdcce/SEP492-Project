import { StatsCard } from './StatsCard';
import { RevenueChart } from './RevenueChart';
import { RecentTransactions } from './RecentTransactions';
import { TopClients } from './TopClients';
import { PerformanceMetrics } from './PerformanceMetrics';
import { ActivityFeed } from './ActivityFeed';
import { TrendingUp, TrendingDown, Users, DollarSign, FileText, Activity } from 'lucide-react';

export function BrokerDashboard() {
  const stats = [
    {
      title: 'Tổng Doanh Thu',
      value: '₫2,450,000,000',
      change: '+12.5%',
      trend: 'up' as const,
      icon: DollarSign,
      color: 'bg-blue-500'
    },
    {
      title: 'Khách Hàng',
      value: '1,234',
      change: '+8.2%',
      trend: 'up' as const,
      icon: Users,
      color: 'bg-green-500'
    },
    {
      title: 'Giao Dịch',
      value: '856',
      change: '-3.1%',
      trend: 'down' as const,
      icon: FileText,
      color: 'bg-purple-500'
    },
    {
      title: 'Hoạt Động',
      value: '98.5%',
      change: '+2.4%',
      trend: 'up' as const,
      icon: Activity,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Broker Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Chào mừng trở lại, Admin</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Hôm nay</p>
                <p className="text-sm font-semibold text-gray-900">17 Tháng 1, 2026</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                A
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-8 max-w-[1600px] mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <div>
            <PerformanceMetrics />
          </div>
        </div>

        {/* Tables Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentTransactions />
          </div>
          <div className="space-y-6">
            <TopClients />
            <ActivityFeed />
          </div>
        </div>
      </main>
    </div>
  );
}
