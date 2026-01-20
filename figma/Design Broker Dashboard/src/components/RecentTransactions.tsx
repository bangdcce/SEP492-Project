import { ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';

const transactions = [
  {
    id: 'TXN-001234',
    client: 'Nguyễn Văn An',
    type: 'Mua',
    amount: '₫125,000,000',
    status: 'Hoàn Thành',
    date: '17/01/2026',
    statusColor: 'bg-green-100 text-green-700',
    trend: 'up'
  },
  {
    id: 'TXN-001235',
    client: 'Trần Thị Bình',
    type: 'Bán',
    amount: '₫85,500,000',
    status: 'Đang Xử Lý',
    date: '17/01/2026',
    statusColor: 'bg-yellow-100 text-yellow-700',
    trend: 'down'
  },
  {
    id: 'TXN-001236',
    client: 'Lê Minh Cường',
    type: 'Mua',
    amount: '₫210,000,000',
    status: 'Hoàn Thành',
    date: '16/01/2026',
    statusColor: 'bg-green-100 text-green-700',
    trend: 'up'
  },
  {
    id: 'TXN-001237',
    client: 'Phạm Thu Dung',
    type: 'Bán',
    amount: '₫95,000,000',
    status: 'Chờ Duyệt',
    date: '16/01/2026',
    statusColor: 'bg-blue-100 text-blue-700',
    trend: 'down'
  },
  {
    id: 'TXN-001238',
    client: 'Hoàng Văn Em',
    type: 'Mua',
    amount: '₫156,200,000',
    status: 'Hoàn Thành',
    date: '15/01/2026',
    statusColor: 'bg-green-100 text-green-700',
    trend: 'up'
  },
  {
    id: 'TXN-001239',
    client: 'Vũ Thị Phượng',
    type: 'Mua',
    amount: '₫178,900,000',
    status: 'Đang Xử Lý',
    date: '15/01/2026',
    statusColor: 'bg-yellow-100 text-yellow-700',
    trend: 'up'
  },
];

export function RecentTransactions() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Giao Dịch Gần Đây</h2>
          <p className="text-sm text-gray-500 mt-1">Danh sách giao dịch mới nhất</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Mã GD</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Khách Hàng</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Loại</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Số Tiền</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Trạng Thái</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Ngày</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-4 px-4">
                  <span className="text-sm font-medium text-gray-900">{transaction.id}</span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-sm text-gray-700">{transaction.client}</span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1">
                    {transaction.trend === 'up' ? (
                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-gray-700">{transaction.type}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className="text-sm font-semibold text-gray-900">{transaction.amount}</span>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${transaction.statusColor}`}>
                    {transaction.status}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-sm text-gray-500">{transaction.date}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">Hiển thị 6 trong tổng số 856 giao dịch</p>
        <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
          Xem Tất Cả
        </button>
      </div>
    </div>
  );
}
