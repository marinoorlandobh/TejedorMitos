
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Layers, Loader2, Sparkles, CheckCircle, XCircle, RefreshCw, Edit3, Bot, X, PauseCircle, Eraser } from 'lucide-react';
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
import { MYTHOLOGICAL_CULTURES, IMAGE_STYLES, ASPECT_RATIOS, IMAGE_QUALITIES, IMAGE_PROVIDERS } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { mapAspectRatioToDimensions, mapQualityToSteps } from '@/lib/utils';

// Helper function to add a timeout to a promise
const withTimeout = <T,>(promise: Promise<T>, ms: number, timeoutError = new Error(`La operación tardó más de ${ms / 1000} segundos y fue cancelada.`)): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(timeoutError);
        }, ms);

        promise.then(
            (res) => {
                clearTimeout(timeoutId);
                resolve(res);
            },
            (err) => {
                clearTimeout(timeoutId);
                reject(err);
            }
        );
    });
};


const batchCreateSchema = z.object({
  prompts: z.string().min(1, "Se requiere al menos un prompt."),
  culture: z.string().min(1, "La cultura mitológica es obligatoria."),
  style: z.string().min(1, "El estilo visual es obligatorio."),
  aspectRatio: z.string().min(1, "La relación de aspecto es obligatoria."),
  imageQuality: z.string().min(1, "La calidad de imagen es obligatoria."),
  provider: z.enum(['google-ai', 'stable-diffusion']).default('google-ai'),
});

type BatchCreateFormData = z.infer<typeof batchCreateSchema>;

interface ResultState {
    prompt: string;
    culture: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    imageId?: string;
    name?: string;
    error?: string;
}

export default function BatchCreatePage() {
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [results, setResults] = useState<ResultState[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { addCreation, getImageData } = useHistory();
  const { toast } = useToast();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedPromptText, setEditedPromptText] = useState('');
  const [isFixingIndex, setIsFixingIndex] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const form = useForm<BatchCreateFormData>({
    resolver: zodResolver(batchCreateSchema),
    defaultValues: {
      prompts: '',
      culture: MYTHOLOGICAL_CULTURES[0],
      style: IMAGE_STYLES[0],
      aspectRatio: ASPECT_RATIOS[0],
      imageQuality: IMAGE_QUALITIES[0],
      provider: 'google-ai',
    },
  });
  
  const promptsValue = form.watch('prompts');

  useEffect(() => {
    const cachedData = localStorage.getItem('mythWeaverBatchCreateCache');
    if (cachedData) {
        try {
            const { results: parsedResults, prompts: cachedPrompts } = JSON.parse(cachedData);
            if (Array.isArray(parsedResults)) {
                // If any items were 'processing' when the page was left, reset them to 'pending'
                // so they can be retried without appearing to be 'stuck'.
                const correctedResults = parsedResults.map((r: ResultState) => 
                    r.status === 'processing' 
                        ? { ...r, status: 'pending' } 
                        : r
                );
                setResults(correctedResults);
            }
            if (cachedPrompts && typeof cachedPrompts === 'string') {
                form.setValue('prompts', cachedPrompts);
            }
        } catch (e) {
            console.error("Error loading batch create cache:", e);
            localStorage.removeItem('mythWeaverBatchCreateCache');
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  useEffect(() => {
    if (results.length > 0) {
        const cache = {
            results,
            prompts: promptsValue
        };
        try {
            localStorage.setItem('mythWeaverBatchCreateCache', JSON.stringify(cache));
        } catch (e) {
            if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                const resultsToCache = results.map(({ imageId, ...rest }) => rest);
                const minimalCache = { results: resultsToCache, prompts: promptsValue };
                try {
                    localStorage.setItem('mythWeaverBatchCreateCache', JSON.stringify(minimalCache));
                } catch (nestedError) {
                    console.error("Error saving minimal batch create cache:", nestedError);
                    toast({
                        variant: "destructive",
                        title: "Error de Caché",
                        description: "No se pudo guardar el progreso del lote. El almacenamiento del navegador está lleno.",
                    });
                }
            } else {
                console.error("Error saving batch create cache:", e);
            }
        }
    } else {
        localStorage.removeItem('mythWeaverBatchCreateCache');
    }
  }, [results, promptsValue, toast]);


  const getProcessedPromptLines = (rawPrompts: string): string[] => {
    let lines = rawPrompts.split('\n').filter(p => p.trim() !== '');
    if (lines.length === 0) return [];

    const firstLine = lines[0].toLowerCase().trim();
    const normalizedFirstLine = firstLine.replace(/\t/g, ';').replace(/\s*;\s*/g, ';');
    
    const commonHeaders = [
      'cultura;prompt',
      'culture;prompt',
      'cultura;details',
      'culture;details',
    ];

    if (commonHeaders.includes(normalizedFirstLine)) {
      lines.shift(); 
    }
    return lines;
  };

  async function generateWithStableDiffusion(prompt: string, aspectRatio: string, imageQuality: string) {
    const apiUrl = 'http://127.0.0.1:7860';
    const dimensions = mapAspectRatioToDimensions(aspectRatio);
    const steps = mapQualityToSteps(imageQuality);

    const payload = {
        prompt,
        negative_prompt: "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, bad anatomy, watermark, signature, cut off, low contrast, underexposed, overexposed, bad art, beginner, amateur, distorted face, blurry, draft, grainy",
        seed: -1,
        sampler_name: "DPM++ 2M Karras",
        batch_size: 1,
        n_iter: 1,
        steps: steps,
        cfg_scale: 7,
        width: dimensions.width,
        height: dimensions.height,
        restore_faces: true,
    };

    try {
        const response = await fetch(`${apiUrl}/sdapi/v1/txt2img`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            mode: 'cors',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error de la API de Stable Diffusion: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        if (!result.images || result.images.length === 0) {
            throw new Error("La API de Stable Diffusion no devolvió ninguna imagen.");
        }

        return { imageUrl: `data:image/png;base64,${result.images[0]}`, prompt };
    } catch (e: any) {
        if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
             throw new Error(`Error de red o CORS. Asegúrate de que Stable Diffusion Web UI se ejecuta con '--cors-allow-origins="*"' y que puedes acceder a ${apiUrl}/docs`);
        }
        throw e;
    }
  }

    const runSinglePromptProcessing = async (promptToProcess: string, cultureForPrompt: string, settings: Omit<BatchCreateFormData, 'prompts' | 'culture'>) => {
        const { creationName, entity } = await extractDetailsFromPromptAction({ promptText: promptToProcess });
        
        const aiInputParams: GeneratedParams = {
            culture: cultureForPrompt,
            entity: entity,
            details: promptToProcess,
            style: settings.style,
            aspectRatio: settings.aspectRatio,
            imageQuality: settings.imageQuality,
            provider: settings.provider,
        };

        let imageResult;
        const fullPrompt = `A visually rich image in the style of ${aiInputParams.style}. The primary subject is the entity '${entity}' from ${cultureForPrompt} mythology. Key scene details include: ${promptToProcess}. The desired image quality is ${aiInputParams.imageQuality}.`;

        if (settings.provider === 'stable-diffusion') {
            imageResult = await generateWithStableDiffusion(fullPrompt, aiInputParams.aspectRatio, aiInputParams.imageQuality);
        } else {
            imageResult = await generateMythImageAction(aiInputParams);
        }
        
        const creationResult = await addCreation('generated', creationName, aiInputParams, { prompt: imageResult.prompt }, imageResult.imageUrl);
        
        if (!creationResult) {
            throw new Error("Error al guardar la creación en la base de datos.");
        }

        return { imageId: creationResult.imageId, name: creationName };
    };


  const processSinglePrompt = async (promptToProcess: string, cultureForPrompt: string, index: number, settings: Omit<BatchCreateFormData, 'prompts' | 'culture'>) => {
    setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'processing', error: undefined, prompt: promptToProcess, culture: cultureForPrompt } : r));

    try {
        const TIMEOUT_MS = 60000; 
        const result = await withTimeout(
            runSinglePromptProcessing(promptToProcess, cultureForPrompt, settings),
            TIMEOUT_MS
        );
        
        setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'success', imageId: result.imageId, name: result.name } : r));
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
    let processedLine = line.replace('\t', ';').trim();
    let prompt = processedLine;
    const separatorIndex = processedLine.indexOf(';');

    if (separatorIndex > 0 && separatorIndex < processedLine.length - 1) {
        const potentialCulture = processedLine.substring(0, separatorIndex).trim();
        const restOfPrompt = processedLine.substring(separatorIndex + 1).trim();

        if (potentialCulture && restOfPrompt) {
            culture = potentialCulture;
            prompt = restOfPrompt;
        }
    }
    
    return { prompt, culture };
  };

  async function onSubmit(data: BatchCreateFormData) {
    setIsProcessingBatch(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const promptLines = getProcessedPromptLines(data.prompts);

    if (promptLines.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "Por favor, introduce al menos un prompt." });
        setIsProcessingBatch(false);
        return;
    }

    const tasks = promptLines.map(line => getTaskForLine(line, data.culture));

    setResults(tasks.map(t => ({ prompt: t.prompt, culture: t.culture, status: 'pending' })));
    setProgress({ current: 0, total: tasks.length });
    
    const { prompts, culture: defaultCulture, ...restOfSettings } = data;

    for (const [index, task] of tasks.entries()) {
        if (signal.aborted) {
            toast({ title: "Proceso Detenido", description: "La generación en lote fue detenida por el usuario." });
            break; 
        }
        await processSinglePrompt(task.prompt, task.culture, index, restOfSettings);
        setProgress(prev => ({ ...prev, current: index + 1 }));
    }

    setIsProcessingBatch(false);
    abortControllerRef.current = null; 

    if (!signal.aborted) {
      toast({ title: "Proceso en Lote Terminado", description: "Revisa los resultados en la lista." });
    }
  }

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
  };

  const handleRetry = (index: number) => {
    const result = results[index];
    if (result) {
      const { prompt, culture } = result;
      const { prompts, culture: defaultCulture, ...restOfSettings } = form.getValues();
      processSinglePrompt(prompt, culture, index, restOfSettings);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    const result = results[index];
    const defaultCulture = form.getValues().culture;
    let textToEdit = result.prompt;

    if (result.culture !== defaultCulture) {
        textToEdit = `${result.culture};${result.prompt}`;
    }
    setEditedPromptText(textToEdit);
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
    const result = results[index];
    if (!result) {
        setIsFixingIndex(null);
        return;
    }
    const { prompt: originalPrompt, culture } = result;

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

  const handleClearResults = () => {
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setIsProcessingBatch(false);
    localStorage.removeItem('mythWeaverBatchCreateCache');
    toast({ title: "Resultados Limpiados", description: "Se ha borrado el historial del lote." });
  };
  
  const handleClearSuccessful = () => {
    setResults(prev => prev.filter(r => r.status !== 'success'));
    toast({ title: "Exitosos Limpiados", description: "Se han quitado los prompts generados correctamente de la lista." });
  };
  
  const handleRetryAll = async () => {
    setIsProcessingBatch(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    toast({ title: "Reintentando el lote...", description: "Se procesarán todos los elementos pendientes o con error." });

    const { prompts, culture: defaultCulture, ...restOfSettings } = form.getValues();
    
    for (const [index, result] of results.entries()) {
        if (signal.aborted) {
            toast({ title: "Proceso Detenido", description: "La generación en lote fue detenida." });
            break;
        }
        if (result.status === 'pending' || result.status === 'error') {
            await processSinglePrompt(result.prompt, result.culture, index, restOfSettings);
        }
    }

    setIsProcessingBatch(false);
    abortControllerRef.current = null;
    if (!signal.aborted) {
      toast({ title: "Proceso de reintento terminado", description: "Revisa los resultados actualizados." });
    }
  };
  
  const hasFailedOrPendingItems = results.some(r => r.status === 'error' || r.status === 'pending');
  const hasSuccessfulItems = results.some(r => r.status === 'success');
  const successfulCount = results.filter(r => r.status === 'success').length;

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
                            Usa el formato `cultura;prompt` por línea, o copia y pega directamente desde una hoja de cálculo (columnas: Cultura, Prompt). El encabezado se ignorará automáticamente.
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
                  <FormField
                      control={form.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Motor de Generación</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecciona un motor" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {IMAGE_PROVIDERS.map(provider => (
                                <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <div className="flex w-full items-center gap-2">
                    <Button type="submit" disabled={isProcessingBatch} className="flex-grow">
                      {isProcessingBatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      {isProcessingBatch ? `Generando ${progress.current} de ${progress.total}...` : 'Generar Lote'}
                    </Button>
                    {isProcessingBatch && (
                      <Button variant="destructive" onClick={handleStopProcessing} type="button" className="shrink-0">
                        <PauseCircle className="mr-2 h-4 w-4" />
                        Detener
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                           <CardTitle>2. Progreso y Resultados</CardTitle>
                           {results.length > 0 && (
                                <>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="secondary">{results.length} Total</Badge>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Número total de prompts en el lote.</p></TooltipContent>
                                    </Tooltip>
                                     <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">{successfulCount} Exitosos</Badge>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Número de imágenes generadas con éxito.</p></TooltipContent>
                                    </Tooltip>
                                </>
                            )}
                        </div>
                        <CardDescription>El estado de cada creación aparecerá aquí.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {hasSuccessfulItems && !isProcessingBatch && (
                            <Button variant="outline" size="sm" onClick={handleClearSuccessful}>
                                <Eraser className="mr-2 h-4 w-4" />
                                Limpiar Exitosos
                            </Button>
                        )}
                        {hasFailedOrPendingItems && !isProcessingBatch && (
                            <Button variant="outline" size="sm" onClick={handleRetryAll}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reintentar Todo
                            </Button>
                        )}
                        {results.length > 0 && !isProcessingBatch && (
                            <Button variant="ghost" size="icon" onClick={handleClearResults} title="Limpiar resultados">
                                <X className="h-5 w-5" />
                                <span className="sr-only">Limpiar</span>
                            </Button>
                        )}
                    </div>
                </div>
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
                                {result.status === 'success' && result.imageId && result.name && (
                                  <BatchImageItem imageId={result.imageId} name={result.name} />
                                )}
                            </div>
                            {editingIndex === index ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancelar</Button>
                                <Button size="sm" onClick={handleSaveAndRetry}><Sparkles className="mr-2 h-4 w-4" /> Guardar y Reintentar</Button>
                              </div>
                            ) : result.status === 'error' && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleAiFixAndRetry(index)} disabled={isProcessingBatch || isFixingIndex === index}>
                                  {isFixingIndex === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                                   Corregir con IA
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleEdit(index)} disabled={isProcessingBatch || isFixingIndex === index}><Edit3 className="mr-2 h-4 w-4" /> Editar</Button>
                                <Button size="sm" onClick={() => handleRetry(index)} disabled={isProcessingBatch || isFixingIndex === index}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button>
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

const BatchImageItem: React.FC<{ imageId: string, name: string }> = ({ imageId, name }) => {
  const { getImageData } = useHistory();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    const fetchImage = async () => {
      setLoading(true);
      const imgData = await getImageData(imageId);
      if (isActive && imgData) {
        setImageUrl(imgData.imageDataUri);
      }
      setLoading(false);
    };
    fetchImage();
    return () => { isActive = false; };
  }, [imageId, getImageData]);

  if (loading) {
    return <div className="w-16 h-16 flex items-center justify-center bg-muted/50 rounded-md"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!imageUrl) {
    return <div className="w-16 h-16 flex items-center justify-center bg-muted/50 text-xs text-muted-foreground p-1 text-center rounded-md">No Encontrada</div>;
  }

  return <Image src={imageUrl} alt={`Generated: ${name}`} width={64} height={64} className="rounded-md object-cover shadow-md" data-ai-hint="mythological art" />;
};

    