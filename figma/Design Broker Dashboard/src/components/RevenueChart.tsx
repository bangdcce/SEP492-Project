import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { month: 'T1', revenue: 180, profit: 120 },
  { month: 'T2', revenue: 220, profit: 150 },
  { month: 'T3', revenue: 195, profit: 130 },
  { month: 'T4', revenue: 250, profit: 180 },
  { month: 'T5', revenue: 280, profit: 200 },
  { month: 'T6', revenue: 310, profit: 220 },
  { month: 'T7', revenue: 290, profit: 210 },
  { month: 'T8', revenue: 340, profit: 250 },
  { month: 'T9', revenue: 380, profit: 280 },
  { month: 'T10', revenue: 420, profit: 310 },
  { month: 'T11', revenue: 450, profit: 340 },
  { month: 'T12', revenue: 480, profit: 360 },
];

export function RevenueChart() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Doanh Thu & Lợi Nhuận</h2>
          <p className="text-sm text-gray-500 mt-1">Theo dõi hiệu suất kinh doanh năm 2026</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">
            Năm
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            Tháng
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            Tuần
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
          />
          <Legend />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorRevenue)" 
            name="Doanh Thu (triệu ₫)"
          />
          <Area 
            type="monotone" 
            dataKey="profit" 
            stroke="#10b981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorProfit)" 
            name="Lợi Nhuận (triệu ₫)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
