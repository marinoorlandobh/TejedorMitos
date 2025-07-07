"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Wand2, Loader2, Eye, Copy, AlertTriangle } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useHistory } from '@/contexts/HistoryContext';
import { useToast } from '@/hooks/use-toast';
import { generateMythImageAction } from '@/lib/actions';
import type { GeneratedParams } from '@/lib/types';
import { MYTHOLOGICAL_CULTURES, IMAGE_STYLES, ASPECT_RATIOS, IMAGE_QUALITIES } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

const createMythSchema = z.object({
  name: z.string().min(1, "El nombre de la creación es obligatorio.").max(100),
  culture: z.string().min(1, "La cultura mitológica es obligatoria."),
  customCultureDetails: z.string().optional(),
  entity: z.string().min(1, "La entidad/tema es obligatoria.").max(150),
  details: z.string().min(1, "Los detalles descriptivos son obligatorios.").max(1000),
  style: z.string().min(1, "El estilo visual es obligatorio."),
  aspectRatio: z.string().min(1, "La relación de aspecto es obligatoria."),
  imageQuality: z.string().min(1, "La calidad de imagen es obligatoria."),
});

type CreateMythFormData = z.infer<typeof createMythSchema>;

export default function CreateMythPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const { addCreation } = useHistory();
  const { toast } = useToast();

  const form = useForm<CreateMythFormData>({
    resolver: zodResolver(createMythSchema),
    defaultValues: {
      name: '',
      culture: MYTHOLOGICAL_CULTURES[0],
      customCultureDetails: '',
      entity: '',
      details: '',
      style: IMAGE_STYLES[0],
      aspectRatio: ASPECT_RATIOS[0],
      imageQuality: IMAGE_QUALITIES[0],
    },
  });

  const selectedCulture = form.watch('culture');

  async function onSubmit(data: CreateMythFormData) {
    setIsLoading(true);
    setGeneratedImage(null);
    setGeneratedPrompt(null);
    setGenerationError(null);

    const aiInputParams: GeneratedParams = {
      culture: data.culture === 'Personalizada' ? data.customCultureDetails || 'Personalizada' : data.culture,
      entity: data.entity,
      details: data.details,
      style: data.style,
      aspectRatio: data.aspectRatio,
      imageQuality: data.imageQuality,
    };

    try {
      const result = await generateMythImageAction(aiInputParams);
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
      const errorMessage = error.message || "Error al crear el mito.";
      setGenerationError(errorMessage);
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "¡Copiado!", description: "Prompt copiado al portapapeles." });
  };

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
            <Wand2 className="mr-3 h-10 w-10" />
            Crea Tu Mito
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Da vida a tus visiones mitológicas. Describe tu concepto y deja que la IA teja las imágenes.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Describe Tu Visión</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona una cultura" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {MYTHOLOGICAL_CULTURES.map(culture => (
                                <SelectItem key={culture} value={culture}>{culture}</SelectItem>
                              ))}
                            </SelectContent>
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
                            <FormLabel>Detalles de Cultura Personalizada</FormLabel>
                            <FormControl>
                              <Input placeholder="Describe tu cultura personalizada" {...field} />
                            </FormControl>
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
                        <FormControl>
                          <Input placeholder="Ej: Zeus, Fénix, Árbol del Mundo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detalles Descriptivos</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Ej: Sosteniendo un rayo, rodeado de nebulosas arremolinadas, ruinas antiguas en un bosque neblinoso..." {...field} rows={4} />
                        </FormControl>
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
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecciona un estilo" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {IMAGE_STYLES.map(style => (
                                <SelectItem key={style} value={style}>{style}</SelectItem>
                              ))}
                            </SelectContent>
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
                          <FormLabel>Relación de Aspecto</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecciona relación de aspecto" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ASPECT_RATIOS.map(ratio => (
                                <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                      control={form.control}
                      name="imageQuality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Calidad de Imagen</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecciona calidad de imagen" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {IMAGE_QUALITIES.map(quality => (
                                <SelectItem key={quality} value={quality}>{quality}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Tejer Mi Mito
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-lg flex flex-col">
            <CardHeader>
              <CardTitle>Tu Mito Tejido</CardTitle>
              <CardDescription>La interpretación de la IA de tu visión aparecerá aquí.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center">
              {isLoading && (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                  <p className="text-lg">Tejiendo tu mito... por favor espera.</p>
                </div>
              )}
              {!isLoading && generationError && (
                 <div className="text-center text-destructive p-8 border-2 border-dashed border-destructive/50 rounded-lg">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                  <p className="font-semibold">Error en la Generación</p>
                  <p className="text-sm mt-1">{generationError}</p>
                </div>
              )}
              {!isLoading && !generationError && generatedImage && (
                <div className="w-full">
                  <Image
                    src={generatedImage}
                    alt="Imagen mitológica generada"
                    width={512}
                    height={512}
                    className="rounded-lg object-contain max-h-[400px] w-auto mx-auto shadow-md"
                    data-ai-hint="mythological art"
                  />
                </div>
              )}
              {!isLoading && !generationError && !generatedImage && (
                <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                  <Eye className="h-12 w-12 mx-auto mb-2" />
                  <p>Tu creación se mostrará aquí una vez generada.</p>
                </div>
              )}
            </CardContent>
            {generatedPrompt && !isLoading && (
              <CardFooter className="flex-col items-start gap-2 border-t pt-4">
                <h3 className="font-semibold">Prompt Generado:</h3>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md break-words">{generatedPrompt}</p>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedPrompt)}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar Prompt
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
