import { DashboardLayout } from "@/shared/components/layouts";
import { Card, Spinner, Button } from "@/shared/components/ui";
import { useAuditLogs } from "@/features/audit-logs";
import { formatRelativeTime } from "@/shared/utils";

export default function AuditLogsPage() {
  const { data, meta, loading, error, goToPage, refresh } = useAuditLogs();

  return (
    <DashboardLayout
      title="Nhật ký hoạt động"
      description="Theo dõi tất cả hoạt động trong hệ thống"
      actions={
        <Button onClick={refresh} variant="secondary">
          🔄 Làm mới
        </Button>
      }
    >
      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive">
            Lỗi: {error.message}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Người thực hiện
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Hành động
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Đối tượng
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Thời gian
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    data.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-accent/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                              {log.actor?.fullName?.charAt(0) || "U"}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {log.actor?.fullName || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {log.actor?.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {log.entityType} #{log.entityId}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatRelativeTime(log.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Trang {meta.page} / {meta.totalPages} ({meta.total} bản ghi)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goToPage(meta.page - 1)}
                    disabled={meta.page <= 1}
                  >
                    ← Trước
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goToPage(meta.page + 1)}
                    disabled={meta.page >= meta.totalPages}
                  >
                    Sau →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </DashboardLayout>
  );
}
