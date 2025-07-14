
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Wand2, Loader2, Eye, Copy, X } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useHistory } from '@/contexts/HistoryContext';
import { useToast } from '@/hooks/use-toast';
import { generateMythImageAction, generateImageWithStableDiffusionClientAction } from '@/lib/actions';
import type { GeneratedParams } from '@/lib/types';
import { MYTHOLOGICAL_CULTURES, IMAGE_STYLES, ASPECT_RATIOS, IMAGE_QUALITIES, IMAGE_PROVIDERS } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateFromPromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prompt: string;
}

const createMythSchema = z.object({
  name: z.string().min(1, "El nombre de la creación es obligatorio.").max(100),
  culture: z.string().min(1, "La cultura mitológica es obligatoria."),
  customCultureDetails: z.string().optional(),
  entity: z.string().min(1, "La entidad/tema es obligatoria.").max(150),
  details: z.string().min(1, "Los detalles descriptivos son obligatorios.").max(1000),
  style: z.string().min(1, "El estilo visual es obligatorio."),
  aspectRatio: z.string().min(1, "La relación de aspecto es obligatoria."),
  imageQuality: z.string().min(1, "La calidad de imagen es obligatoria."),
  provider: z.enum(['google-ai', 'stable-diffusion']).default('google-ai'),
});

type CreateMythFormData = z.infer<typeof createMythSchema>;

export function CreateFromPromptDialog({ open, onOpenChange, prompt }: CreateFromPromptDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const { addCreation } = useHistory();
  const { toast } = useToast();

  const form = useForm<CreateMythFormData>({
    resolver: zodResolver(createMythSchema),
    defaultValues: {
      name: '',
      culture: MYTHOLOGICAL_CULTURES[0],
      customCultureDetails: '',
      entity: '',
      details: prompt || '',
      style: IMAGE_STYLES[0],
      aspectRatio: ASPECT_RATIOS[0],
      imageQuality: IMAGE_QUALITIES[0],
      provider: 'google-ai',
    },
  });

  useEffect(() => {
    // Reset form and results when dialog is re-opened with a new prompt
    form.reset({
      name: '',
      culture: MYTHOLOGICAL_CULTURES[0],
      customCultureDetails: '',
      entity: '',
      details: prompt,
      style: IMAGE_STYLES[0],
      aspectRatio: ASPECT_RATIOS[0],
      imageQuality: IMAGE_QUALITIES[0],
      provider: 'google-ai',
    });
    setGeneratedImage(null);
    setGeneratedPrompt(null);
  }, [prompt, form, open]);

  const selectedCulture = form.watch('culture');

  async function onSubmit(data: CreateMythFormData) {
    setIsLoading(true);
    setGeneratedImage(null);
    setGeneratedPrompt(null);

    const aiInputParams: GeneratedParams = {
      culture: data.culture === 'Personalizada' ? data.customCultureDetails || 'Personalizada' : data.culture,
      entity: data.entity,
      details: data.details,
      style: data.style,
      aspectRatio: data.aspectRatio,
      imageQuality: data.imageQuality,
      provider: data.provider,
    };

    try {
      let result;
      const fullPrompt = `A visually rich image in the style of ${aiInputParams.style}. The primary subject is the entity '${aiInputParams.entity}' from ${aiInputParams.culture} mythology. Key scene details include: ${aiInputParams.details}. The desired image quality is ${aiInputParams.imageQuality}.`;
      
      if (data.provider === 'stable-diffusion') {
        const sdResult = await generateImageWithStableDiffusionClientAction({
            prompt: fullPrompt,
            aspectRatio: aiInputParams.aspectRatio,
            imageQuality: aiInputParams.imageQuality
        });
        result = { ...sdResult, prompt: fullPrompt };
      } else {
        result = await generateMythImageAction(aiInputParams);
      }
      
      setGeneratedImage(result.imageUrl);
      setGeneratedPrompt(result.prompt);

      await addCreation(
        'generated',
        data.name,
        aiInputParams,
        { prompt: result.prompt },
        result.imageUrl
      );
      toast({ title: "¡Mito Creado!", description: "Tu creación ha sido guardada en tu galería." });
    } catch (error: any) {
      console.error("Error generating myth:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Error al crear el mito." });
    } finally {
      setIsLoading(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "¡Copiado!", description: "Prompt copiado al portapapeles." });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <ScrollArea className="max-h-[85vh] pr-6">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center"><Wand2 className="mr-3 h-7 w-7" /> Crear Mito desde Prompt</DialogTitle>
            <DialogDescription>
              Completa los detalles para generar una imagen a partir del prompt seleccionado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
            <div> {/* Form Column */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de la Creación</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Trueno de Zeus, Espíritu del Bosque" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="culture"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cultura Mitológica</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una cultura" /></SelectTrigger></FormControl>
                            <SelectContent>{MYTHOLOGICAL_CULTURES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {selectedCulture === 'Personalizada' && (
                      <FormField
                        control={form.control}
                        name="customCultureDetails"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Det. Cultura</FormLabel>
                            <FormControl><Input placeholder="Describe tu cultura" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="entity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entidad / Tema</FormLabel>
                        <FormControl><Input placeholder="Ej: Zeus, Fénix" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detalles Descriptivos (Prompt)</FormLabel>
                        <FormControl><Textarea {...field} rows={6} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="style"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estilo Visual</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un estilo" /></SelectTrigger></FormControl>
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
                          <FormLabel>Relación Aspecto</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona relación" /></SelectTrigger></FormControl>
                            <SelectContent>{ASPECT_RATIOS.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                          control={form.control}
                          name="imageQuality"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Calidad de Imagen</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona calidad" /></SelectTrigger></FormControl>
                                <SelectContent>{IMAGE_QUALITIES.map(q => (<SelectItem key={q} value={q}>{q}</SelectItem>))}</SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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
                  </div>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Tejer Mi Mito
                  </Button>
                </form>
              </Form>
            </div>
            
            <div className="flex flex-col"> {/* Result Column */}
                <Card className="shadow-lg flex flex-col flex-grow">
                    <CardHeader className='pb-2'>
                        <CardTitle>Tu Mito Tejido</CardTitle>
                        <CardDescription>El resultado aparecerá aquí.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col items-center justify-center">
                    {isLoading && (
                        <div className="flex flex-col items-center text-muted-foreground">
                        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                        <p className="text-lg">Tejiendo tu mito...</p>
                        </div>
                    )}
                    {!isLoading && generatedImage && (
                        <div className="w-full">
                        <Image
                            src={generatedImage}
                            alt="Imagen mitológica generada"
                            width={512}
                            height={512}
                            className="rounded-lg object-contain max-h-[300px] w-auto mx-auto shadow-md"
                            data-ai-hint="mythological art"
                        />
                        </div>
                    )}
                    {!isLoading && !generatedImage && (
                        <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg h-full flex items-center justify-center">
                            <Eye className="h-12 w-12 mx-auto mb-2" />
                            <p>Tu creación se mostrará aquí.</p>
                        </div>
                    )}
                    </CardContent>
                    {generatedPrompt && !isLoading && (
                    <CardFooter className="flex-col items-start gap-2 border-t pt-4">
                        <h3 className="font-semibold">Prompt Generado:</h3>
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md break-words">{generatedPrompt}</p>
                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedPrompt)}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar
                        </Button>
                    </CardFooter>
                    )}
                </Card>
            </div>
          </div>

        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
