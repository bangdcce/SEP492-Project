import { Bell, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const activities = [
  {
    type: 'success',
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-100',
    title: 'Giao dịch hoàn thành',
    description: 'TXN-001234 đã được xác nhận',
    time: '5 phút trước'
  },
  {
    type: 'warning',
    icon: AlertCircle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100',
    title: 'Chờ phê duyệt',
    description: 'TXN-001237 cần xác nhận',
    time: '15 phút trước'
  },
  {
    type: 'info',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    title: 'Đang xử lý',
    description: 'TXN-001235 đang được xử lý',
    time: '30 phút trước'
  },
  {
    type: 'success',
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-100',
    title: 'Khách hàng mới',
    description: 'Vũ Thị Phượng đã đăng ký',
    time: '1 giờ trước'
  },
];

export function ActivityFeed() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-gray-700" />
        <h2 className="text-lg font-bold text-gray-900">Hoạt Động Gần Đây</h2>
      </div>
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          return (
            <div key={index} className="flex gap-3">
              <div className={`${activity.bgColor} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${activity.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </div>
      <button className="w-full mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
        Xem Tất Cả
      </button>
    </div>
  );
}
