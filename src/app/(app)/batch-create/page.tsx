
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { generateMythImageAction, fixImagePromptAction, regenerateCreationNameAction } from '@/lib/actions';
import type { GeneratedParams } from '@/lib/types';
import { MYTHOLOGICAL_CULTURES, IMAGE_STYLES, ASPECT_RATIOS, IMAGE_QUALITIES, IMAGE_PROVIDERS } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { mapAspectRatioToDimensions, mapQualityToSteps } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const batchCreateSchema = z.object({
  prompts: z.string().min(1, "Se requiere al menos un prompt."),
  culture: z.string().min(1, "La cultura mitológica es obligatoria."),
  style: z.string().min(1, "El estilo visual es obligatorio."),
  aspectRatio: z.string().min(1, "La relación de aspecto es obligatoria."),
  imageQuality: z.string().min(1, "La calidad de imagen es obligatoria."),
  provider: z.enum(['google-ai', 'stable-diffusion']).default('google-ai'),
  checkpoint: z.string().optional(),
});

type BatchCreateFormData = z.infer<typeof batchCreateSchema>;

interface ResultState {
    prompt: string;
    culture: string;
    provider: 'google-ai' | 'stable-diffusion';
    checkpoint?: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    imageId?: string;
    name?: string;
    entity?: string;
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
      checkpoint: '',
    },
  });
  
  const formValues = form.watch();

  useEffect(() => {
      const fetchSdCheckpoint = async () => {
        if (formValues.provider === 'stable-diffusion') {
            try {
                const response = await fetch('http://127.0.0.1:7860/sdapi/v1/options', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    mode: 'cors',
                });
                if (response.ok) {
                    const options = await response.json();
                    if (options.sd_model_checkpoint) {
                        form.setValue('checkpoint', options.sd_model_checkpoint);
                        toast({ title: "Checkpoint Detectado", description: `Se ha cargado automáticamente el checkpoint: ${options.sd_model_checkpoint}`, duration: 3000 });
                    }
                }
            } catch (error) {
                console.warn("No se pudo conectar a la API de Stable Diffusion para obtener el checkpoint. Se requiere entrada manual.");
            }
        }
    };
    fetchSdCheckpoint();
  }, [formValues.provider, form, toast]);

  useEffect(() => {
    const cachedData = localStorage.getItem('mythWeaverBatchCreateCache');
    if (cachedData) {
        try {
            const { results: parsedResults, formState: cachedFormState } = JSON.parse(cachedData);
            if (Array.isArray(parsedResults)) {
                const correctedResults = parsedResults.map((r: ResultState) => 
                    r.status === 'processing' 
                        ? { ...r, status: 'pending' } 
                        : r
                );
                setResults(correctedResults);
                 if (correctedResults.some((r: ResultState) => r.status !== 'success' && r.status !== 'pending')) {
                    setIsProcessingBatch(true);
                }
            }
            if (cachedFormState) {
                form.reset(cachedFormState);
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
            formState: formValues
        };
        try {
            localStorage.setItem('mythWeaverBatchCreateCache', JSON.stringify(cache));
        } catch (e) {
            if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                const resultsToCache = results.map(({ imageId, ...rest }) => rest);
                const minimalCache = { results: resultsToCache, formState: formValues };
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
        setIsProcessingBatch(false);
    }
  }, [results, formValues, toast]);


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

    const generateWithStableDiffusion = useCallback(async (fullPrompt: string, aspectRatio: string, imageQuality: string, checkpoint?: string) => {
        const apiUrl = 'http://127.0.0.1:7860';
        const dimensions = mapAspectRatioToDimensions(aspectRatio);
        const steps = mapQualityToSteps(imageQuality);

        const payload = {
            prompt: fullPrompt,
            negative_prompt: "deformed, bad anatomy, disfigured, poorly drawn face, mutation, mutated, extra limb, ugly, disgusting, poorly drawn hands, missing limb, floating limbs, disconnected limbs, malformed hands, blurry, ((((mutated hands and fingers)))), watermark, watermarked, oversaturated, censorship, censored, sensible, text, bare breasts, nude",
            seed: -1,
            sampler_name: "DPM++ 2M Karras",
            batch_size: 1,
            n_iter: 1,
            steps: steps,
            cfg_scale: 7,
            width: dimensions.width,
            height: dimensions.height,
            restore_faces: true,
            override_settings: checkpoint ? { sd_model_checkpoint: checkpoint } : {},
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

            return `data:image/png;base64,${result.images[0]}`;
        } catch (e: any) {
            if (e.message.includes('Failed to fetch')) {
                throw new Error(`Error de red o CORS. Asegúrate de que Stable Diffusion Web UI se ejecuta con '--cors-allow-origins="*"' y que puedes acceder a ${apiUrl}/docs`);
            }
            throw e;
        }
    }, []);

    const runSinglePromptProcessing = useCallback(async (index: number) => {
        let resultToProcess!: ResultState;
        setResults(prev => {
            resultToProcess = prev[index];
            if (!resultToProcess) return prev;
            return prev.map((r, idx) => idx === index ? { ...r, status: 'processing', error: undefined } : r);
        });
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const settings = form.getValues();
        let creationName = `Creación en Lote #${index + 1}`;
        let entity = 'Desconocido';

        try {
            // Step 1: Extract Name and Entity
            const fullPromptForNaming = `A visually rich image in the style of ${settings.style}. The primary subject is from ${resultToProcess.culture} mythology. Key scene details include: ${resultToProcess.prompt}. The desired image quality is ${settings.imageQuality}.`;
            const nameResult = await regenerateCreationNameAction({ promptText: fullPromptForNaming });
            creationName = nameResult.creationName;
            entity = nameResult.entity;
        } catch (e) {
            console.warn(`Name extraction failed for prompt #${index}. Using generic names.`, e);
            // Fallback to generic names, continue with image generation
        }

        const aiInputParams: GeneratedParams = {
            culture: resultToProcess.culture,
            entity: entity,
            details: resultToProcess.prompt,
            style: settings.style,
            aspectRatio: settings.aspectRatio,
            imageQuality: settings.imageQuality,
            provider: resultToProcess.provider,
            checkpoint: resultToProcess.checkpoint,
        };

        try {
            // Step 2: Generate Image
            let imageResult;
            if (resultToProcess.provider === 'stable-diffusion') {
                 const fullPrompt = `A visually rich image in the style of ${aiInputParams.style}. The primary subject is the entity '${entity}' from ${aiInputParams.culture} mythology. Key scene details include: ${resultToProcess.prompt}. The desired image quality is ${aiInputParams.imageQuality}.`;
                const imageUrl = await generateWithStableDiffusion(fullPrompt, aiInputParams.aspectRatio, aiInputParams.imageQuality, aiInputParams.checkpoint);
                imageResult = { imageUrl, prompt: fullPrompt };
            } else {
                imageResult = await generateMythImageAction(aiInputParams);
            }
            
            const creationResult = await addCreation('generated', creationName, aiInputParams, { prompt: imageResult.prompt }, imageResult.imageUrl);
            
            if (!creationResult) {
                throw new Error("Error al guardar la creación en la base de datos.");
            }
            
            setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'success', imageId: creationResult.imageId, name: creationName, entity: entity } : r));
            return true;
        } catch (error: any) {
            console.error(`Error processing prompt: ${resultToProcess.prompt}`, error);
            const errorMessage = error.message || "Error desconocido";
            setResults(prev => prev.map((r, idx) => idx === index ? { ...r, status: 'error', error: errorMessage, name: resultToProcess.name || `Fallido #${index+1}` } : r));
            return false;
        }
    }, [addCreation, generateWithStableDiffusion, form]);


    const processImageGeneration = useCallback(async (signal: AbortSignal) => {
        let currentResults;
        setResults(prev => {
            currentResults = prev;
            return prev;
        });

        await new Promise(resolve => setTimeout(resolve, 0)); 

        if (!currentResults) {
            console.error("Could not get current results for processing.");
            setIsProcessingBatch(false);
            return;
        }

        for (let i = 0; i < currentResults.length; i++) {
            if (signal.aborted) {
                toast({ title: "Proceso Detenido", description: "La generación de imágenes fue detenida por el usuario." });
                break;
            }
            const currentResult = currentResults[i];
            if (currentResult.status === 'pending' || currentResult.status === 'error') {
              await runSinglePromptProcessing(i);
            }
            setProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setResults(prev => {
            if (!prev.some(r => r.status !== 'success')) {
                setIsProcessingBatch(false);
            }
            return prev;
        });

        abortControllerRef.current = null;

        if (!signal.aborted) {
            toast({ title: "Generación de Imágenes Terminada", description: "Revisa los resultados en la lista." });
        }
    }, [runSinglePromptProcessing, toast]);

    
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

    let initialResults = tasks.map(t => ({ 
        prompt: t.prompt, 
        culture: t.culture, 
        provider: data.provider, 
        checkpoint: data.checkpoint,
        status: 'pending' as const
    }));
    
    setResults(initialResults);
    setProgress({ current: 0, total: tasks.length });
    
    setTimeout(() => processImageGeneration(signal), 100);
  }

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
  };

  const handleRetry = (index: number) => {
    runSinglePromptProcessing(index);
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

  const handleSaveAndRetry = async () => {
    if (editingIndex === null) return;

    const task = getTaskForLine(editedPromptText, form.getValues().culture);
    
    let updatedResults = results.map((r, idx) => {
        if (idx === editingIndex) {
            return { ...r, prompt: task.prompt, culture: task.culture, status: 'pending' as const };
        }
        return r;
    });

    setResults(updatedResults);
    
    const indexToProcess = editingIndex;
    handleCancelEdit();
    setTimeout(() => runSinglePromptProcessing(indexToProcess), 0);
  };

  const handleAiFixAndRetry = async (index: number) => {
    setIsFixingIndex(index);
    const result = results[index];
    if (!result) {
        setIsFixingIndex(null);
        return;
    }
    const { prompt: originalPrompt } = result;

    try {
      toast({ title: "La IA está trabajando...", description: "Revisando y corrigiendo el prompt." });
      const { fixedPrompt } = await fixImagePromptAction({ promptText: originalPrompt });
      toast({ title: "¡Prompt Corregido!", description: "Reintentando la generación con el nuevo prompt." });
      
      const finalResults = results.map((r, idx) => idx === index ? { ...r, prompt: fixedPrompt, status: 'pending' as const } : r);
      setResults(finalResults);
      
      setTimeout(() => runSinglePromptProcessing(index), 0);

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
    const newResults = results.filter(r => r.status !== 'success');
    setResults(newResults);
    if (newResults.length === 0) {
        setIsProcessingBatch(false);
    }
    toast({ title: "Exitosos Limpiados", description: "Se han quitado los prompts generados correctamente de la lista." });
  };
  
  const handleRetryAll = async () => {
    setIsProcessingBatch(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    toast({ title: "Reintentando el lote...", description: "Se procesarán todos los elementos pendientes o con error." });

    const itemsToRetryIndices = results.map((_, index) => index).filter(index => {
        const result = results[index];
        return result.status === 'pending' || result.status === 'error';
    });
    
    setProgress({ current: 0, total: itemsToRetryIndices.length });

    for (const [i, index] of itemsToRetryIndices.entries()) {
        if (signal.aborted) {
            toast({ title: "Proceso Detenido", description: "La generación en lote fue detenida." });
            break;
        }
        await runSinglePromptProcessing(index);
        setProgress(prev => ({ ...prev, current: i + 1 }));
    }
    
    setResults(currentResults => {
        if (!currentResults.some(r => r.status !== 'success')) {
            setIsProcessingBatch(false);
        }
        return currentResults;
    });

    abortControllerRef.current = null;
    if (!signal.aborted) {
      toast({ title: "Proceso de reintento terminado", description: "Revisa los resultados actualizados." });
    }
  };
  
  const hasFailedOrPendingItems = results.some(r => r.status === 'error' || r.status === 'pending');
  const hasSuccessfulItems = results.some(r => r.status === 'success');
  const successfulCount = results.filter(r => r.status === 'success').length;
  const isBatchActive = results.length > 0;

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
                          <Textarea placeholder="Pega tus prompts aquí, uno por línea..." {...field} rows={8} disabled={isBatchActive} />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isBatchActive}>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isBatchActive}>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isBatchActive}>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isBatchActive}>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isBatchActive}>
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
                    {formValues.provider === 'stable-diffusion' && (
                        <FormField
                            control={form.control}
                            name="checkpoint"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Checkpoint Base (automático o manual)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Detectando checkpoint actual..." {...field} disabled={isBatchActive} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                  <div className="flex w-full items-center gap-2">
                    <Button type="submit" disabled={isBatchActive} className="flex-grow">
                      <Sparkles className="mr-2 h-4 w-4" />
                       Generar Lote
                    </Button>
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
                        {isProcessingBatch && (
                          <Button variant="destructive" onClick={handleStopProcessing} type="button" size="sm">
                            <PauseCircle className="mr-2 h-4 w-4" />
                            Detener
                          </Button>
                        )}
                        {hasSuccessfulItems && !isProcessingBatch && (
                            <Button variant="outline" size="sm" onClick={handleClearSuccessful}>
                                <Eraser className="mr-2 h-4 w-4" />
                                Limpiar Exitosos
                            </Button>
                        )}
                        {hasFailedOrPendingItems && !isProcessingBatch && (
                            <Button variant="outline" size="sm" onClick={handleRetryAll}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reintentar Fallidos
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
                                    <div className="text-xs text-muted-foreground mt-1">
                                        <span>{result.culture} &bull; {IMAGE_PROVIDERS.find(p => p.id === result.provider)?.name || result.provider}</span>
                                    </div>
                                    {result.name && <p className="text-xs text-primary font-semibold">Nombre: {result.name}</p>}
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
