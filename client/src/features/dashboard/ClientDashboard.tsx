
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Spinner } from '@/shared/components/ui';
import { wizardService } from '../wizard/services/wizardService';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, PlusCircle, AlertCircle } from 'lucide-react';
import { ROUTES } from '@/constants';

export function ClientDashboard() {
  const navigate = useNavigate();
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchRecent = async () => {
    try {
      // In a real app we might have a specific endpoint for recent or dashboard stats
      const data = await wizardService.getRequests();
      // Just take top 3
      setRecentRequests(data.slice(0, 3));
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;

  const attentionItems = recentRequests.filter(r => r.status === 'PENDING' || r.status === 'WAITING_FOR_REVIEW');

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Hero Section */}
      <div className="bg-primary/5 rounded-2xl p-8 mb-8 border border-primary/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
                <h1 className="text-3xl font-bold text-primary mb-2">Welcome back!</h1>
                <p className="text-muted-foreground text-lg">Ready to start your next big project?</p>
            </div>
            <Button size="lg" className="gap-2 shadow-lg" onClick={() => navigate(ROUTES.WIZARD)}>
                <PlusCircle className="w-5 h-5" /> Create New Request
            </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left Column: Attention & Stats */}
        <div className="md:col-span-2 space-y-8">
            
            {/* Attention Needed */}
            {attentionItems.length > 0 && (
                <section>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" /> 
                        Needs Attention
                    </h2>
                    <div className="grid gap-3">
                        {attentionItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-4 border border-amber-200 bg-amber-50 rounded-lg">
                                <div>
                                    <div className="font-medium">{item.title}</div>
                                    <div className="text-sm text-amber-700">Waiting for broker review</div>
                                </div>
                                <Button variant="outline" size="sm" className="bg-white" onClick={() => navigate(`/requests/${item.id}`)}>
                                    View
                                </Button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Recent Activity */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Recent Requests</h2>
                    <Button variant="link" onClick={() => navigate(ROUTES.MY_REQUESTS)}>View All</Button>
                </div>
                
                <div className="grid gap-4">
                     {recentRequests.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                            No recent activity.
                        </div>
                     ) : (
                        recentRequests.map(request => (
                            <Card key={request.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(request.status === 'DRAFT' ? `/wizard?draftId=${request.id}` : `/requests/${request.id}`)}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-12 rounded-full ${
                                            request.status === 'DRAFT' ? 'bg-gray-300' : 
                                            request.status === 'PENDING' ? 'bg-yellow-400' : 'bg-green-500'
                                        }`} />
                                        <div>
                                            <h3 className="font-semibold">{request.title || 'Untitled Draft'}</h3>
                                            <p className="text-sm text-muted-foreground">{format(new Date(request.createdAt), 'MMM d, yyyy')}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline">{request.status}</Badge>
                                </CardContent>
                            </Card>
                        ))
                     )}
                </div>
            </section>
        </div>

        {/* Right Column: Quick Links / Resources */}
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-none">
                <CardHeader>
                    <h3 className="font-semibold text-blue-900">How it works</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800">1</div>
                        <p className="text-sm text-blue-800">Describe your project idea in our Wizard.</p>
                    </div>
                    <div className="flex gap-3">
                         <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800">2</div>
                         <p className="text-sm text-blue-800">Our Brokers review and formalize specs.</p>
                    </div>
                    <div className="flex gap-3">
                         <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800">3</div>
                         <p className="text-sm text-blue-800">Get matched with top Freelancers.</p>
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <h3 className="font-semibold">Project Stats</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Active Projects</span>
                        <span className="font-bold">0</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Requests</span>
                        <span className="font-bold">{recentRequests.length}</span>
                    </div>
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}
