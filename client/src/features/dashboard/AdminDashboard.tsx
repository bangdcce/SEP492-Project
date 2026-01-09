
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui";

export function AdminDashboard() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
             <CardTitle>System Overview</CardTitle>
          </CardHeader>
          <CardContent>
             <p>Welcome to the Admin Dashboard. Manage users, reviews, and settings here.</p>
          </CardContent>
        </Card>
        {/* Add more admin widgets here */}
      </div>
    </div>
  );
}
