
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Layers, Loader2, Sparkles, CheckCircle, XCircle, RefreshCw, Edit3, Bot } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as FormDescriptionComponent } from '@/components/ui/form';
import { useHistory } from '@/contexts/HistoryContext';
import { useToast } from '@/hooks/use-toast';
import { generateMythImageAction, extractDetailsFromPromptAction, fixImagePromptAction } from '@/lib/actions';
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
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [results, setResults] = useState<ResultState[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { addCreation } = useHistory();
  const { toast } = useToast();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedPromptText, setEditedPromptText] = useState('');
  const [isFixingIndex, setIsFixingIndex] = useState<number | null>(null);

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

  const processSinglePrompt = async (promptToProcess: string, cultureForPrompt: string, index: number, settings: Omit<BatchCreateFormData, 'prompts' | 'culture'>) => {
    setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'processing', error: undefined, prompt: promptToProcess } : r));

    try {
        const { creationName, entity } = await extractDetailsFromPromptAction({ promptText: promptToProcess });
        const aiInputParams: GeneratedParams = {
            culture: cultureForPrompt,
            entity: entity,
            details: promptToProcess,
            style: settings.style,
            aspectRatio: settings.aspectRatio,
            imageQuality: settings.imageQuality,
        };
        const imageResult = await generateMythImageAction(aiInputParams);
        await addCreation('generated', creationName, aiInputParams, { prompt: imageResult.prompt }, imageResult.imageUrl);
        setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'success', imageUrl: imageResult.imageUrl, name: creationName } : r));
        return true;
    } catch (error: any) {
        console.error(`Error processing prompt: ${promptToProcess}`, error);
        const errorMessage = error.message || "Error desconocido";
        setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'error', error: errorMessage } : r));
        return false;
    }
  };
  
  const getTaskForLine = (line: string, defaultCulture: string) => {
    let culture = defaultCulture;
    let prompt = line.trim();
    if (prompt.includes(';')) {
        const parts = prompt.split(';');
        const potentialCulture = parts[0].trim();
        if (potentialCulture) {
            culture = potentialCulture;
            prompt = parts.slice(1).join(';').trim();
        }
    }
    return { prompt, culture };
  };

  async function onSubmit(data: BatchCreateFormData) {
    setIsProcessingBatch(true);
    const promptLines = data.prompts.split('\n').filter(p => p.trim() !== '');
    if (promptLines.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "Por favor, introduce al menos un prompt." });
        setIsProcessingBatch(false);
        return;
    }

    const tasks = promptLines.map(line => getTaskForLine(line, data.culture));

    setResults(tasks.map(t => ({ prompt: t.prompt, status: 'pending' })));
    setProgress({ current: 0, total: tasks.length });
    
    const { prompts, culture: defaultCulture, ...restOfSettings } = data;

    for (const [index, task] of tasks.entries()) {
        await processSinglePrompt(task.prompt, task.culture, index, restOfSettings);
        setProgress(prev => ({ ...prev, current: index + 1 }));
    }

    setIsProcessingBatch(false);
    toast({ title: "Proceso en Lote Terminado", description: "Revisa los resultados en la lista." });
  }

  const getTaskForIndex = (index: number) => {
    const allLines = form.getValues().prompts.split('\n').filter(p => p.trim() !== '');
    const line = allLines[index];
    if (!line) return null;
    return getTaskForLine(line, form.getValues().culture);
  }

  const handleRetry = (index: number) => {
    const task = getTaskForIndex(index);
    if (task) {
      const { prompt, culture } = task;
      const { prompts, culture: defaultCulture, ...restOfSettings } = form.getValues();
      processSinglePrompt(prompt, culture, index, restOfSettings);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    const allLines = form.getValues().prompts.split('\n').filter(p => p.trim() !== '');
    const line = allLines[index] || results[index].prompt;
    setEditedPromptText(line);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditedPromptText('');
  };

  const handleSaveAndRetry = () => {
    if (editingIndex !== null) {
      const task = getTaskForLine(editedPromptText, form.getValues().culture);
      const { prompts, culture: defaultCulture, ...restOfSettings } = form.getValues();
      processSinglePrompt(task.prompt, task.culture, editingIndex, restOfSettings);
      handleCancelEdit();
    }
  };

  const handleAiFixAndRetry = async (index: number) => {
    setIsFixingIndex(index);
    const task = getTaskForIndex(index);
    if (!task) {
        setIsFixingIndex(null);
        return;
    }
    const { prompt: originalPrompt, culture } = task;

    try {
      toast({ title: "La IA está trabajando...", description: "Revisando y corrigiendo el prompt." });
      const { fixedPrompt } = await fixImagePromptAction({ promptText: originalPrompt });
      toast({ title: "¡Prompt Corregido!", description: "Reintentando la generación con el nuevo prompt." });
      
      const { prompts, culture: defaultCulture, ...restOfSettings } = form.getValues();
      await processSinglePrompt(fixedPrompt, culture, index, restOfSettings);

    } catch (error: any) {
        console.error("Error fixing prompt with AI:", error);
        toast({ variant: "destructive", title: "Error de la IA", description: error.message || "No se pudo corregir el prompt." });
        setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'error', error: "Falló la corrección con IA." } : r));
    } finally {
      setIsFixingIndex(null);
    }
  };


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
                         <FormDescriptionComponent>
                            Usa el formato `cultura;prompt` para especificar una cultura diferente por línea.
                          </FormDescriptionComponent>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="culture"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cultura Mitológica (por defecto)</FormLabel>
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
                  <Button type="submit" disabled={isProcessingBatch} className="w-full">
                    {isProcessingBatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {isProcessingBatch ? `Generando ${progress.current} de ${progress.total}...` : 'Generar Lote'}
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
                          <div key={index} className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 pt-1">
                                    {result.status === 'processing' && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                                    {result.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                    {result.status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                                    {result.status === 'pending' && <div className="h-5 w-5 rounded-full bg-muted-foreground/50" />}
                                </div>
                                <div className="flex-1">
                                    {editingIndex === index ? (
                                      <Textarea
                                        value={editedPromptText}
                                        onChange={(e) => setEditedPromptText(e.target.value)}
                                        className="mb-2 bg-background"
                                        rows={4}
                                      />
                                    ) : (
                                      <p className="text-sm font-medium line-clamp-3">{result.prompt}</p>
                                    )}
                                    {result.status === 'success' && result.name && <p className="text-xs text-primary font-semibold">Generado: {result.name}</p>}
                                    {result.status === 'error' && result.error && <p className="text-xs text-destructive">{result.error}</p>}
                                </div>
                                {result.status === 'success' && result.imageUrl && (
                                    <Image src={result.imageUrl} alt={`Generated: ${result.name}`} width={64} height={64} className="rounded-md object-cover shadow-md" data-ai-hint="mythological art" />
                                )}
                            </div>
                            {editingIndex === index ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancelar</Button>
                                <Button size="sm" onClick={handleSaveAndRetry}><Sparkles className="mr-2 h-4 w-4" /> Guardar y Reintentar</Button>
                              </div>
                            ) : result.status === 'error' && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleAiFixAndRetry(index)} disabled={isFixingIndex === index}>
                                  {isFixingIndex === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                                   Corregir con IA
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleEdit(index)} disabled={isFixingIndex === index}><Edit3 className="mr-2 h-4 w-4" /> Editar</Button>
                                <Button size="sm" onClick={() => handleRetry(index)} disabled={isFixingIndex === index}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button>
                              </div>
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
