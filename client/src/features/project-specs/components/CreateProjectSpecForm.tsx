import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/shared/components/ui/form';
import { Separator } from '@/shared/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';

import { DeliverableType } from '../types';
import type { CreateProjectSpecDTO } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const BANNED_KEYWORDS = [
  'đẹp', 'sang trọng', 'hiện đại', 'thân thiện', 'beautiful', 'modern', 'friendly', 'elegant',
  'nhanh', 'tốt', 'mạnh mẽ', 'cao cấp', 'fast', 'good', 'powerful', 'premium', 'smooth', 'easy', 'simple'
];

const checkKeywords = (text: string): string[] => {
  if (!text) return [];
  const lower = text.toLowerCase();
  return BANNED_KEYWORDS.filter(k => lower.includes(k));
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  techStack: z.string().min(1, 'Tech stack is required'),
  totalBudget: z.coerce.number().min(0, 'Budget must be positive'),
  
  // Validation: Features
  features: z.array(z.object({
    title: z.string().min(1, 'Feature title is required'),
    description: z.string().min(1, 'Description is required'),
    complexity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    acceptanceCriteria: z.array(z.object({
      value: z.string().min(5, 'Criteria must be at least 5 chars')
    })).min(1, 'At least one acceptance criterion is required'),
  })).optional(),

  // Validation: Milestones
  milestones: z.array(
    z.object({
      title: z.string().min(1, 'Milestone title is required'),
      description: z.string().min(1, 'Description is required'),
      amount: z.coerce.number().min(0, 'Amount must be positive'),
      deliverableType: z.nativeEnum(DeliverableType),
      retentionAmount: z.coerce.number().min(0).default(0),
      duration: z.coerce.number().optional(),
    })
  ).min(1, 'At least one milestone is required'),
}).refine((data) => {
    const milestoneSum = data.milestones.reduce((sum, m) => sum + (m.amount || 0), 0);
    return Math.abs(milestoneSum - data.totalBudget) <= 0.01;
}, {
    message: "Total budget must match the sum of milestone amounts",
    path: ["totalBudget"],
}).refine((data) => {
    if (data.milestones.length > 0) {
       const firstAmount = data.milestones[0].amount;
       return (firstAmount / data.totalBudget) <= 0.30;
    }
    return true;
}, {
    message: "First milestone cannot exceed 30% of total budget (Anti-Front-loading Rule)",
    path: ["milestones.0.amount"],
}).refine((data) => {
    if (data.milestones.length > 0) {
       const lastAmount = data.milestones[data.milestones.length - 1].amount;
       return (lastAmount / data.totalBudget) >= 0.20;
    }
    return true;
}, {
    message: "Final milestone must be at least 20% of total budget (Completion Guarantee)",
    path: [`milestones`], 
});

type FormValues = z.infer<typeof formSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface CreateProjectSpecFormProps {
  requestId: string;
  projectRequest?: any; // Avoiding full type import to prevent circular deps or complex imports, or better use the type if available
  onSubmit: (data: CreateProjectSpecDTO) => void;
  isSubmitting?: boolean;
}

export function CreateProjectSpecForm({ requestId, projectRequest, onSubmit, isSubmitting }: CreateProjectSpecFormProps) {
  const [warnings, setWarnings] = useState<string[]>([]);

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      techStack: '',
      totalBudget: 0,
      features: [],
      milestones: [
        { 
          title: 'Project Setup & Design', 
          description: 'Initial setup and design phase', 
          amount: 0, 
          deliverableType: DeliverableType.DESIGN_PROTOTYPE,
          retentionAmount: 0 
        }
      ],
    },
    mode: 'onChange' 
  });

  const { fields: milestoneFields, append: appendMilestone, remove: removeMilestone } = useFieldArray({
    control: form.control,
    name: 'milestones',
  });

  const { fields: featureFields, append: appendFeature, remove: removeFeature } = useFieldArray({
    control: form.control,
    name: 'features',
  });

  // Real-time Warning Check
  const watchedMilestones = form.watch('milestones');
  const watchedDescription = form.watch('description');
  const watchedFeatures = form.watch('features');

  useEffect(() => {
    const newWarnings: string[] = [];
    
    // Check Description
    if (watchedDescription) {
      const keywords = checkKeywords(watchedDescription);
      if (keywords.length > 0) newWarnings.push(`Description contains vague words: ${keywords.join(', ')}`);
    }

    // Check Features
    watchedFeatures?.forEach((f, idx) => {
       if (f?.description) {
          const keywords = checkKeywords(f.description);
          if (keywords.length > 0) newWarnings.push(`Feature ${idx + 1} uses vague words: ${keywords.join(', ')}`);
       }
    });

    setWarnings(newWarnings);
  }, [watchedDescription, watchedFeatures]);

  // Auto-calc Total Budget from Milestones
  // Separate effect to ensure clean dependency on ONLY milestones
  useEffect(() => {
      if (watchedMilestones) {
          // Ensure we are summing numbers, handling potential string inputs
          const sum = watchedMilestones.reduce((acc, m) => {
              const val = typeof m.amount === 'string' ? parseFloat(m.amount) : Number(m.amount);
              return acc + (isNaN(val) ? 0 : val);
          }, 0);
          
          const currentTotal = form.getValues('totalBudget');
          if (Math.abs(sum - currentTotal) > 0.01) {
             form.setValue('totalBudget', sum, { shouldValidate: true });
          }
      }
  }, [watchedMilestones, form.setValue, form.getValues]);

  // Nested Array handler helper (Acceptance Criteria) is tricky with useFieldArray at top level.
  // We will inline the Criteria list management inside the Feature map loop or create a sub-component.
  // For simplicity in this single file, let's create a sub-component `FeatureItem`.

  const handleSubmit = (values: FormValues, status: 'DRAFT' | 'PENDING_APPROVAL' = 'DRAFT') => {
    // Transform data to match DTO
    const payload: CreateProjectSpecDTO = {
      requestId,
      status: status as any, // Cast to enum
      title: values.title,
      description: values.description,
      totalBudget: values.totalBudget,
      techStack: values.techStack,
      features: values.features?.map(f => ({
         title: f.title,
         description: f.description,
         complexity: f.complexity,
         acceptanceCriteria: f.acceptanceCriteria.map(ac => ac.value)
      })),
      milestones: values.milestones.map((m, index) => ({
         title: m.title,
         description: m.description,
         amount: m.amount,
         duration: m.duration,
         deliverableType: m.deliverableType,
         retentionAmount: m.retentionAmount,
         sortOrder: index + 1
      }))
    };
    
    onSubmit(payload);
  };

  const milestoneSum = form.watch('milestones').reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  const budget = form.watch('totalBudget') || 0;

  return (
    <Form {...form}>
      <form className="space-y-8 max-w-4xl mx-auto py-6">
        
        {/* HEADER & WARNINGS */}
        <div className="space-y-2">
           <h1 className="text-2xl font-bold">Create Project Specification</h1>
           <p className="text-muted-foreground">Define the scope, features, and milestones for your project. Be specific to ensure quality.</p>
        </div>

        {warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Governance Warnings</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 mt-2">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* 1. GENERAL INFO */}
        <Card>
          <CardHeader><CardTitle>1. General Information</CardTitle></CardHeader>
          <CardContent className="grid gap-6">
             <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Title</FormLabel>
                  <FormControl><Input placeholder="E-commerce Platform..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
             )} />
             
             <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Overview Description</FormLabel>
                   <CardDescription className="mb-2">Avoid vague words like "beautiful", "fast". Use metrics.</CardDescription>
                  <FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
             )} />

             <FormField control={form.control} name="techStack" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                     Tech Stack
                     {projectRequest?.techPreferences && (
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                           (Client preferred: {projectRequest.techPreferences})
                        </span>
                     )}
                  </FormLabel>
                  <FormControl><Input placeholder="React, NestJS, PostgreSQL, Redis..." {...field} /></FormControl>
                  <FormDescription>Specify required technologies.</FormDescription>
                  <FormMessage />
                </FormItem>
             )} />
          </CardContent>
        </Card>

        {/* 2. FEATURES & CRITERIA */}
        <Card>
           <CardHeader className="flex flex-row items-center justify-between">
              <div>
                 <CardTitle>2. Features & Acceptance Criteria</CardTitle>
                 <CardDescription>Define functional requirements in detail.</CardDescription>
              </div>
              <Button type="button" onClick={() => appendFeature({ title: '', description: '', complexity: 'MEDIUM', acceptanceCriteria: [{ value: '' }] })}>
                 <Plus className="w-4 h-4 mr-2" /> Add Feature
              </Button>
           </CardHeader>
           <CardContent className="space-y-4">
              <Accordion type="multiple" className="w-full">
                 {featureFields.map((field, index) => (
                    <AccordionItem key={field.id} value={field.id}>
                       <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-4 w-full">
                             <span className="font-semibold">Feature {index + 1}</span>
                             <Badge variant="outline">{form.watch(`features.${index}.complexity`)}</Badge>
                             <span className="text-muted-foreground font-normal truncate max-w-[300px]">{form.watch(`features.${index}.title`) || 'Untitled'}</span>
                          </div>
                       </AccordionTrigger>
                       <AccordionContent className="p-4 border rounded-md mt-2 space-y-4 bg-muted/10">
                          <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name={`features.${index}.title`} render={({ field }) => (
                                <FormItem><FormLabel>Feature Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                             )} />
                             <FormField control={form.control} name={`features.${index}.complexity`} render={({ field }) => (
                                <FormItem><FormLabel>Complexity</FormLabel>
                                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                         <SelectItem value="LOW">Low (Simple CRUD)</SelectItem>
                                         <SelectItem value="MEDIUM">Medium (Logic involved)</SelectItem>
                                         <SelectItem value="HIGH">High (Complex algo/integration)</SelectItem>
                                      </SelectContent>
                                   </Select>
                                   <FormMessage />
                                </FormItem>
                             )} />
                          </div>
                          
                          <FormField control={form.control} name={`features.${index}.description`} render={({ field }) => (
                             <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                          )} />

                          {/* Acceptance Criteria Sub-List */}
                           <AcceptanceCriteriaList nestIndex={index} control={form.control} />
                          
                          <Button type="button" variant="destructive" size="sm" onClick={() => removeFeature(index)} className="mt-2">
                             <Trash2 className="w-4 h-4 mr-2" /> Remove Feature
                          </Button>
                       </AccordionContent>
                    </AccordionItem>
                 ))}
              </Accordion>
              {featureFields.length === 0 && <p className="text-center text-muted-foreground py-4">No features added yet.</p>}
           </CardContent>
        </Card>

        {/* 3. BUDGET & MILESTONES */}
        <Card>
           <CardHeader><CardTitle>3. Budget & Milestones</CardTitle></CardHeader>
           <CardContent className="space-y-6">
              <FormField control={form.control} name="totalBudget" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                     Total Budget ($) 
                     {projectRequest?.budgetRange && (
                        <span className="ml-2 text-sm text-muted-foreground font-normal">
                           (Client Range: {projectRequest.budgetRange})
                        </span>
                     )}
                  </FormLabel>
                  <FormControl>
                     <Input 
                        type="number" 
                        step="10" 
                        className="text-lg font-bold bg-muted" 
                        readOnly 
                        {...field} 
                     />
                  </FormControl>
                  <FormDescription>Calculated automatically from sum of milestones.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <Separator />

              {milestoneFields.map((field, index) => (
                 <div key={field.id} className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm relative">
                    <div className="absolute top-4 right-4">
                       <Button type="button" variant="ghost" size="icon" onClick={() => removeMilestone(index)} disabled={milestoneFields.length <= 1}>
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                       </Button>
                    </div>
                    <div className="grid gap-4">
                       <h4 className="font-semibold flex items-center gap-2">
                          Milestone {index + 1}
                          {index === 0 && <Badge variant="secondary">Deposit (Max 30%)</Badge>}
                          {index === milestoneFields.length - 1 && <Badge variant="secondary">Final (Min 20%)</Badge>}
                       </h4>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name={`milestones.${index}.title`} render={({ field }) => (
                             <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="e.g. Phase 1" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`milestones.${index}.amount`} render={({ field }) => (
                             <FormItem><FormLabel>Amount ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`milestones.${index}.deliverableType`} render={({ field }) => (
                                <FormItem><FormLabel>Deliverable Type</FormLabel>
                                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                         <SelectItem value={DeliverableType.DESIGN_PROTOTYPE}>Design Prototype (Figma)</SelectItem>
                                         <SelectItem value={DeliverableType.API_DOCS}>API Docs (Swagger)</SelectItem>
                                         <SelectItem value={DeliverableType.SOURCE_CODE}>Source Code (Git)</SelectItem>
                                         <SelectItem value={DeliverableType.DEPLOYMENT}>Live Deployment</SelectItem>
                                         <SelectItem value={DeliverableType.SYS_OPERATION_DOCS}>SysOps Docs (Docker)</SelectItem>
                                         <SelectItem value={DeliverableType.OTHER}>Other</SelectItem>
                                      </SelectContent>
                                   </Select>
                                   <FormMessage />
                                </FormItem>
                             )} />
                             <FormField control={form.control} name={`milestones.${index}.retentionAmount`} render={({ field }) => (
                                <FormItem><FormLabel>Retention ($) (Warranty Hold)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                             )} />
                       </div>
                       
                        <FormField control={form.control} name={`milestones.${index}.description`} render={({ field }) => (
                             <FormItem><FormLabel>Deliverables Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                 </div>
              ))}

              <Button type="button" variant="outline" className="w-full dashed" onClick={() => appendMilestone({ title: '', description: '', amount: 0, deliverableType: DeliverableType.SOURCE_CODE, retentionAmount: 0 })}>
                 <Plus className="w-4 h-4 mr-2" /> Add Milestone
              </Button>
              
               {/* Budget Check Footer */}
               <div className={`p-4 rounded-md border text-sm flex justify-between items-center bg-muted`}>
                  <span>Total Budget (Calculated): <strong>${budget}</strong></span>
                  <span>Milestone Sum: <strong>${milestoneSum}</strong></span>
               </div>
               {form.formState.errors.root?.message && (
                  <Alert variant="destructive"><AlertDescription>{form.formState.errors.root.message}</AlertDescription></Alert>
               )}
               {/* Explicit error for last milestone rule if refined generally */}
               {form.formState.errors.milestones?.root?.message && (
                  <p className="text-destructive text-sm font-medium">{form.formState.errors.milestones.root.message}</p>
               )}
           </CardContent>
        </Card>

        {/* ACTIONS */}
        <div className="flex justify-end gap-4 pb-20">
           <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
           
           <Button 
                type="button" 
                variant="secondary" 
                disabled={isSubmitting} 
                onClick={form.handleSubmit(
                  (d) => handleSubmit(d, 'DRAFT'),
                  (errors) => console.error('Form Validation Errors:', errors)
                )}
            >
              Save Draft
           </Button>
           
           <Button 
                type="button" 
                disabled={isSubmitting} 
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                onClick={form.handleSubmit(
                  (d) => handleSubmit(d, 'PENDING_APPROVAL'),
                  (errors) => console.error('Form Validation Errors:', errors)
                )}
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
           </Button>
        </div>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: Acceptance Criteria List
// ─────────────────────────────────────────────────────────────────────────────

function AcceptanceCriteriaList({ nestIndex, control }: { nestIndex: number, control: any }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `features.${nestIndex}.acceptanceCriteria`,
  });

  return (
    <div className="space-y-3 pl-4 border-l-2 border-primary/20">
       <div className="flex justify-between items-center">
          <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Acceptance Criteria (Checklist)</FormLabel>
          <Button type="button" variant="ghost" size="sm" onClick={() => append({ value: '' })}><Plus className="w-3 h-3 mr-1" /> Add Criteria</Button>
       </div>
       {fields.map((item, k) => (
          <div key={item.id} className="flex gap-2 items-center">
             <FormField
                control={control}
                name={`features.${nestIndex}.acceptanceCriteria.${k}.value`}
                render={({ field }) => (
                   <FormItem className="flex-1 space-y-0">
                      <FormControl><Input placeholder="e.g. User receives 2FA email within 1 minute" {...field} className="h-8 text-sm" /></FormControl>
                      <FormMessage className="text-xs" />
                   </FormItem>
                )}
             />
             <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => remove(k)} disabled={fields.length <= 1}>
                {/* Prevent deleting last one to force at least 1 rule */}
                <Trash2 className="w-4 h-4" />
             </Button>
          </div>
       ))}
    </div>
  );
}
