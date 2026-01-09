
import { useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui";
import { ArrowLeft, FileText, Download, Plus, Calendar, Clock } from "lucide-react";

interface MilestoneDetailViewProps {
  milestoneId: number;
  onBack: () => void;
}

export function MilestoneDetailView({ milestoneId, onBack }: MilestoneDetailViewProps) {
  const [activeTab, setActiveTab] = useState("kanban");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Milestone {milestoneId}: Phase {milestoneId} Delivery</h2>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                <Calendar className="w-3 h-3" /> <span>Due: Oct {10 + milestoneId * 14}, 2025</span>
                <span className="mx-2">•</span>
                <Clock className="w-3 h-3" /> <span>2 weeks duration</span>
            </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="kanban">Task Board (Kanban)</TabsTrigger>
          <TabsTrigger value="documents">Deliverables & Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            {/* To Do Column */}
            <div className="flex flex-col h-full bg-muted/30 rounded-lg p-4 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <h3 className="font-semibold text-sm uppercase tracking-wider">To Do</h3>
                        <Badge variant="outline" className="ml-1 text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">3</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    <KanbanCard 
                        title="Setup Project Repo" 
                        tag="DevOps" 
                        assignee="JD" 
                        priority="High"
                    />
                    <KanbanCard 
                        title="Design Database Schema" 
                        tag="Backend" 
                        assignee="AL" 
                        priority="High"
                    />
                    <KanbanCard 
                        title="Initial API Routes" 
                        tag="Backend" 
                    />
                </div>
            </div>

            {/* In Progress Column */}
            <div className="flex flex-col h-full bg-muted/30 rounded-lg p-4 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <h3 className="font-semibold text-sm uppercase tracking-wider">In Progress</h3>
                        <Badge variant="outline" className="ml-1 text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">2</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                     <KanbanCard 
                        title="Authentication Flow" 
                        tag="Frontend" 
                        assignee="ME" 
                        priority="Medium" 
                        date="Today"
                    />
                     <KanbanCard 
                        title="Login Page UI" 
                        tag="Design" 
                        assignee="SK" 
                    />
                </div>
            </div>

            {/* Done Column */}
            <div className="flex flex-col h-full bg-muted/30 rounded-lg p-4 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <h3 className="font-semibold text-sm uppercase tracking-wider">Done</h3>
                        <Badge variant="outline" className="ml-1 text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">1</Badge>
                    </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    <KanbanCard 
                        title="Kickoff Meeting" 
                        tag="Management" 
                        assignee="PM" 
                        done
                    />
                </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Milestone Documents</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DocumentCard 
                            title="Phase 1 Specifications.pdf" 
                            size="2.4 MB" 
                            date="Oct 12, 2025" 
                            type="PDF"
                        />
                        <DocumentCard 
                            title="Wireframes_v1.fig" 
                            size="15 MB" 
                            date="Oct 14, 2025" 
                            type="FIG"
                        />
                        <DocumentCard 
                            title="API_Documentation.md" 
                            size="45 KB" 
                            date="Oct 15, 2025" 
                            type="MD"
                        />
                        <DocumentCard 
                            title="Testing_Plan.docx" 
                            size="1.1 MB" 
                            date="Oct 18, 2025" 
                            type="DOC"
                        />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KanbanCard({ title, tag, assignee, priority, date, done }: any) {
    return (
        <div className={`bg-card p-3 rounded-md shadow-sm border border-border hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${done ? 'opacity-70' : ''}`}>
            <div className="flex justify-between items-start mb-2">
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{tag}</Badge>
                {priority === 'High' && <span className="w-2 h-2 bg-red-500 rounded-full" title="High Priority" />}
                {priority === 'Medium' && <span className="w-2 h-2 bg-yellow-500 rounded-full" title="Medium Priority" />}
            </div>
            <h4 className={`font-medium text-sm mb-3 ${done ? 'line-through text-muted-foreground' : ''}`}>{title}</h4>
            <div className="flex items-center justify-between text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    {assignee ? (
                         <div className="w-6 h-6 rounded-full bg-primary/10 text-[10px] flex items-center justify-center text-primary font-bold">
                            {assignee}
                         </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center">
                            <Plus className="w-3 h-3" />
                        </div>
                    )}
                </div>
                {date && <span className="text-[10px]">{date}</span>}
            </div>
        </div>
    )
}

function DocumentCard({ title, size, date, type }: any) {
    return (
        <div className="flex items-center p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors group">
            <div className="p-3 bg-muted rounded-lg mr-4">
                <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{title}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="font-semibold">{type}</span>
                    <span>•</span>
                    <span>{size}</span>
                    <span>•</span>
                    <span>{date}</span>
                </div>
            </div>
            <Button variant="ghost" size="icon" className="group-hover:text-primary">
                <Download className="w-4 h-4" />
            </Button>
        </div>
    )
}
