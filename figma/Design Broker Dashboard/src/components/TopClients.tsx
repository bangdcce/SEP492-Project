import { Crown } from 'lucide-react';

const clients = [
  { name: 'Nguyễn Văn An', value: '₫450M', transactions: 28, rank: 1, color: 'from-yellow-400 to-yellow-600' },
  { name: 'Trần Thị Bình', value: '₫380M', transactions: 24, rank: 2, color: 'from-gray-300 to-gray-500' },
  { name: 'Lê Minh Cường', value: '₫325M', transactions: 19, rank: 3, color: 'from-orange-400 to-orange-600' },
  { name: 'Phạm Thu Dung', value: '₫290M', transactions: 16, rank: 4, color: 'from-blue-400 to-blue-600' },
  { name: 'Hoàng Văn Em', value: '₫275M', transactions: 15, rank: 5, color: 'from-purple-400 to-purple-600' },
];

export function TopClients() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Crown className="w-5 h-5 text-yellow-500" />
        <h2 className="text-lg font-bold text-gray-900">Top Khách Hàng</h2>
      </div>
      <div className="space-y-4">
        {clients.map((client) => (
          <div key={client.rank} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${client.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
              {client.rank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{client.name}</p>
              <p className="text-xs text-gray-500">{client.transactions} giao dịch</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">{client.value}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
        Xem Thêm
      </button>
    </div>
  );
}
