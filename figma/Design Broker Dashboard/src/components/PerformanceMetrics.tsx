import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const data = [
  { name: 'Hoàn Thành', value: 68, color: '#10b981' },
  { name: 'Đang Xử Lý', value: 22, color: '#f59e0b' },
  { name: 'Chờ Duyệt', value: 10, color: '#6366f1' },
];

export function PerformanceMetrics() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">Trạng Thái Giao Dịch</h2>
        <p className="text-sm text-gray-500 mt-1">Phân bổ theo trạng thái</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={90}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-sm text-gray-700">{item.name}</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
