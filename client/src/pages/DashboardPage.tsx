import { DashboardLayout } from "@/shared/components/layouts";
import { Card } from "@/shared/components/ui";
import { useAuth } from "@/features/auth";

export default function DashboardPage() {
  const { user } = useAuth();

  const stats = [
    { label: "Dự án đang thực hiện", value: "12", icon: "📁" },
    { label: "Công việc hoàn thành", value: "48", icon: "✅" },
    { label: "Tin nhắn mới", value: "5", icon: "💬" },
    { label: "Đánh giá trung bình", value: "4.8", icon: "⭐" },
  ];

  return (
    <DashboardLayout
      title={`Xin chào, ${user?.fullName || "Người dùng"}!`}
      description="Tổng quan hoạt động của bạn trên InterDev"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4">
            <div className="text-3xl">{stat.icon}</div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Hoạt động gần đây" padding="none">
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 hover:bg-accent/50 transition-colors">
                <p className="text-sm font-medium text-foreground">
                  Dự án #{i} đã được cập nhật
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  2 giờ trước
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Thông báo" padding="none">
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 hover:bg-accent/50 transition-colors">
                <p className="text-sm font-medium text-foreground">
                  Bạn có tin nhắn mới từ khách hàng #{i}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  5 phút trước
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
