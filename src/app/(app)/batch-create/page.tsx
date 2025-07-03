
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Layers, Loader2, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useHistory } from '@/contexts/HistoryContext';
import { useToast } from '@/hooks/use-toast';
import { generateMythImageAction, extractDetailsFromPromptAction } from '@/lib/actions';
import type { GeneratedParams } from '@/lib/types';
import { MYTHOLOGICAL_CULTURES, IMAGE_STYLES, ASPECT_RATIOS, IMAGE_QUALITIES } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

const batchCreateSchema = z.object({
  prompts: z.string().min(1, "Se requiere al menos un prompt."),
  culture: z.string().min(1, "La cultura mitológica es obligatoria."),
  style: z.string().min(1, "El estilo visual es obligatorio."),
  aspectRatio: z.string().min(1, "La relación de aspecto es obligatoria."),
  imageQuality: z.string().min(1, "La calidad de imagen es obligatoria."),
});

type BatchCreateFormData = z.infer<typeof batchCreateSchema>;

interface ResultState {
    prompt: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    imageUrl?: string;
    name?: string;
    error?: string;
}

export default function BatchCreatePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ResultState[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { addCreation } = useHistory();
  const { toast } = useToast();

  const form = useForm<BatchCreateFormData>({
    resolver: zodResolver(batchCreateSchema),
    defaultValues: {
      prompts: '',
      culture: MYTHOLOGICAL_CULTURES[0],
      style: IMAGE_STYLES[0],
      aspectRatio: ASPECT_RATIOS[0],
      imageQuality: IMAGE_QUALITIES[0],
    },
  });

  async function onSubmit(data: BatchCreateFormData) {
    setIsLoading(true);
    const promptList = data.prompts.split('\n').filter(p => p.trim() !== '');
    if (promptList.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "Por favor, introduce al menos un prompt." });
        setIsLoading(false);
        return;
    }

    setResults(promptList.map(p => ({ prompt: p, status: 'pending' })));
    setProgress({ current: 0, total: promptList.length });

    for (let i = 0; i < promptList.length; i++) {
        const currentPrompt = promptList[i];
        setProgress({ current: i + 1, total: promptList.length });
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'processing' } : r));

        try {
            const { creationName, entity } = await extractDetailsFromPromptAction({ promptText: currentPrompt });

            const aiInputParams: GeneratedParams = {
                culture: data.culture,
                entity: entity,
                details: currentPrompt,
                style: data.style,
                aspectRatio: data.aspectRatio,
                imageQuality: data.imageQuality,
            };

            const imageResult = await generateMythImageAction(aiInputParams);
            
            await addCreation(
                'generated',
                creationName,
                aiInputParams,
                { prompt: imageResult.prompt },
                imageResult.imageUrl
            );

            setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'success', imageUrl: imageResult.imageUrl, name: creationName } : r));
            toast({ title: `Éxito: "${creationName}"`, description: "La imagen ha sido generada y guardada." });

        } catch (error: any) {
            console.error(`Error processing prompt: ${currentPrompt}`, error);
            const errorMessage = error.message || "Error desconocido";
            setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', error: errorMessage } : r));
            toast({ variant: "destructive", title: `Error en prompt ${i + 1}`, description: errorMessage });
        }
    }

    setIsLoading(false);
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
            <Layers className="mr-3 h-10 w-10" />
            Creación en Lote
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Genera múltiples mitos a partir de una lista de prompts con configuraciones compartidas.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>1. Configuración de Lote</CardTitle>
              <CardDescription>Introduce tus prompts y selecciona los parámetros para todas las creaciones.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="prompts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lista de Prompts</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Pega tus prompts aquí, uno por línea..." {...field} rows={8} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="culture"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cultura Mitológica (para todos)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{MYTHOLOGICAL_CULTURES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     <FormField
                      control={form.control}
                      name="style"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estilo</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{IMAGE_STYLES.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="aspectRatio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aspecto</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{ASPECT_RATIOS.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="imageQuality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Calidad</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{IMAGE_QUALITIES.map(q => (<SelectItem key={q} value={q}>{q}</SelectItem>))}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {isLoading ? `Generando ${progress.current} de ${progress.total}...` : 'Generar Lote'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>2. Progreso y Resultados</CardTitle>
                <CardDescription>El estado de cada creación aparecerá aquí.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                    {results.length === 0 && (
                        <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg h-full flex flex-col justify-center items-center">
                            <Layers className="h-12 w-12 mx-auto mb-2" />
                            <p>Los resultados del lote se mostrarán aquí.</p>
                        </div>
                    )}
                    <div className="space-y-4">
                        {results.map((result, index) => (
                            <div key={index} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                                <div className="flex-shrink-0 pt-1">
                                    {result.status === 'processing' && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                                    {result.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                    {result.status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                                    {result.status === 'pending' && <div className="h-5 w-5 rounded-full bg-muted-foreground/50" />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium line-clamp-2">{result.prompt}</p>
                                    {result.status === 'success' && result.name && <p className="text-xs text-primary font-semibold">Generado: {result.name}</p>}
                                    {result.status === 'error' && result.error && <p className="text-xs text-destructive">{result.error}</p>}
                                ...
                                </div>
                                {result.status === 'success' && result.imageUrl && (
                                    <Image src={result.imageUrl} alt={`Generated: ${result.name}`} width={64} height={64} className="rounded-md object-cover shadow-md" data-ai-hint="mythological art" />
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
