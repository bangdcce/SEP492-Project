import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/shared/components/custom/Button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Separator } from '@/shared/components/ui/separator';
import type { CreateProjectSpecDTO } from '../types';

// strict validation schema matching backend
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  totalBudget: z.coerce.number().min(0, 'Budget must be positive'),
  milestones: z.array(
    z.object({
      title: z.string().min(1, 'Milestone title is required'),
      description: z.string().min(1, 'Milestone description is required'),
      amount: z.coerce.number().min(0, 'Amount must be positive'),
      duration: z.coerce.number().optional(),
    })
  ).min(1, 'At least one milestone is required'),
}).refine((data) => {
    const milestoneSum = data.milestones.reduce((sum, m) => sum + (m.amount || 0), 0);
    return Math.abs(milestoneSum - data.totalBudget) <= 0.01;
}, {
    message: "Total budget must match the sum of milestone amounts",
    path: ["totalBudget"], // Associate error with totalBudget field
});

type FormValues = z.infer<typeof formSchema>;

interface CreateProjectSpecFormProps {
  requestId: string;
  onSubmit: (data: CreateProjectSpecDTO) => void;
  isSubmitting?: boolean;
}

export function CreateProjectSpecForm({ requestId, onSubmit, isSubmitting }: CreateProjectSpecFormProps) {
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any, 
    defaultValues: {
      title: '',
      description: '',
      totalBudget: 0,
      milestones: [{ title: '', description: '', amount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'milestones',
  });

  const handleSubmit = (values: FormValues) => {
    const payload = {
      requestId,
      ...values,
    };
    console.log('[CreateProjectSpecForm] Submitting payload:', payload);
    console.log('[CreateProjectSpecForm] requestId:', requestId, 'type:', typeof requestId);
    onSubmit(payload);
  };

  const milestoneSum = form.watch('milestones').reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Project Specification Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. E-commerce Platform Development" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detailed overview of the project scope..." 
                      className="min-h-[120px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="totalBudget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Budget ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                  {form.formState.errors.totalBudget?.message && (
                     <p className='text-sm text-muted-foreground mt-1'>
                       Current Milestone Sum: <span className={milestoneSum === field.value ? 'text-green-600' : 'text-red-600'}>{milestoneSum}</span>
                     </p>
                  )}
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
             <CardTitle>Milestones</CardTitle>
             <Button 
                type="button" 
                variant="outline" 
                onClick={() => append({ title: '', description: '', amount: 0 })}
             >
                <Plus className="w-4 h-4 mr-2" /> Add Milestone
             </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="relative p-4 border rounded-lg bg-muted/20">
                 <div className="absolute right-4 top-4">
                    {fields.length > 1 && (
                      <Button type="button" variant="outline" className="h-8 w-8 p-0 border-red-200 hover:bg-red-50" onClick={() => remove(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                 </div>
                 
                 <div className="grid gap-4">
                    <h4 className="font-medium text-sm text-muted-foreground">Milestone {index + 1}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <FormField
                          control={form.control}
                          name={`milestones.${index}.title`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Design Phase" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name={`milestones.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                    </div>

                    <FormField
                      control={form.control}
                      name={`milestones.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Deliverables for this milestone..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                 </div>
              </div>
            ))}
             <FormMessage>{form.formState.errors.milestones?.root?.message}</FormMessage>

             <Separator />
             <div className="flex justify-end items-center gap-4 text-sm font-medium">
               <span>Total Budget: {form.watch('totalBudget')}</span>
               <span className={milestoneSum === form.watch('totalBudget') ? 'text-green-600' : 'text-red-600'}>
                  Sum: {milestoneSum}
               </span>
             </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
           <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
           <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Project Spec'}
           </Button>
        </div>
      </form>
    </Form>
  );
}
