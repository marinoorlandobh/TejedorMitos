
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Palette, Loader2, UploadCloud, CheckCircle, Copy, AlertTriangle } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useHistory } from '@/contexts/HistoryContext';
import { useToast } from '@/hooks/use-toast';
import { reimagineUploadedImageAction } from '@/lib/actions';
import type { ReimaginedParams } from '@/lib/types';
import { MYTHOLOGICAL_CULTURES, IMAGE_STYLES, ASPECT_RATIOS, IMAGE_QUALITIES, IMAGE_PROVIDERS } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mapAspectRatioToDimensions, mapQualityToSteps } from '@/lib/utils';

const reimagineImageSchema = z.object({
  name: z.string().min(1, "El nombre de la creación es obligatorio.").max(100),
  originalImageFile: z.custom<FileList>(val => val instanceof FileList && val.length > 0, "Se requiere un archivo de imagen original."),
  contextCulture: z.string().min(1, "La cultura del contexto de la imagen original es obligatoria."),
  contextEntity: z.string().min(1, "La entidad/tema del contexto de la imagen original es obligatoria.").max(150),
  contextDetails: z.string().min(1, "Los detalles del contexto de la imagen original son obligatorios.").max(1000),
  visualStyle: z.string().min(1, "El nuevo estilo visual es obligatorio."),
  aspectRatio: z.string().min(1, "La nueva relación de aspecto es obligatoria."),
  imageQuality: z.string().min(1, "La nueva calidad de imagen es obligatoria."),
  provider: z.enum(['google-ai', 'stable-diffusion']).default('google-ai'),
  checkpoint: z.string().optional(),
});

type ReimagineImageFormData = z.infer<typeof reimagineImageSchema>;

// Helper function to convert File to Data URI
const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function ReimagineImagePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [reimaginedImage, setReimaginedImage] = useState<string | null>(null);
  const [derivedPrompt, setDerivedPrompt] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const { addCreation } = useHistory();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ReimagineImageFormData>({
    resolver: zodResolver(reimagineImageSchema),
    defaultValues: {
      name: '',
      contextCulture: MYTHOLOGICAL_CULTURES[0],
      contextEntity: '',
      contextDetails: '',
      visualStyle: IMAGE_STYLES[0],
      aspectRatio: ASPECT_RATIOS[0],
      imageQuality: IMAGE_QUALITIES[0],
      provider: 'google-ai',
      checkpoint: '',
    },
  });

  const selectedProvider = form.watch('provider');

  useEffect(() => {
    const fetchSdCheckpoint = async () => {
      if (selectedProvider === 'stable-diffusion') {
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
  }, [selectedProvider, form, toast]);

 const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      form.setValue("originalImageFile", files); 
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue("originalImageFile", new DataTransfer().files);
      setOriginalImagePreview(null);
    }
  };

  async function reimagineWithStableDiffusion(originalImage: string, params: ReimaginedParams, checkpoint?: string) {
    const apiUrl = 'http://127.0.0.1:7860';
    
    // We need to derive a prompt using the Google AI flow first, even for SD
    const { derivedPrompt: sdPrompt } = await reimagineUploadedImageAction({
        originalImage: originalImage,
        ...params
    });

    const dimensions = mapAspectRatioToDimensions(params.aspectRatio);
    const steps = mapQualityToSteps(params.imageQuality);

    // For img2img, the original image must not include the 'data:image/png;base64,' prefix.
    const base64Image = originalImage.split(',')[1];
    
    const payload = {
        init_images: [base64Image],
        prompt: sdPrompt,
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
        denoising_strength: 0.75, // Important for img2img
        override_settings: checkpoint ? { sd_model_checkpoint: checkpoint } : {},
    };

    try {
        const response = await fetch(`${apiUrl}/sdapi/v1/img2img`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            mode: 'cors',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error de la API de Stable Diffusion (img2img): ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        if (!result.images || result.images.length === 0) {
            throw new Error("La API de Stable Diffusion (img2img) no devolvió ninguna imagen.");
        }

        return { reimaginedImage: `data:image/png;base64,${result.images[0]}`, derivedPrompt: sdPrompt };
    } catch (e: any) {
        if (e.message.includes('Failed to fetch')) {
             throw new Error(`Error de red o CORS. Asegúrate de que Stable Diffusion Web UI se ejecuta con '--cors-allow-origins="*"' y que puedes acceder a ${apiUrl}/docs`);
        }
        throw e;
    }
  }


  async function onSubmit(data: ReimagineImageFormData) {
    setIsLoading(true);
    setReimaginedImage(null);
    setDerivedPrompt(null);
    setGenerationError(null);

    if (!data.originalImageFile || data.originalImageFile.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, sube una imagen original." });
      setIsLoading(false);
      return;
    }
    
    const imageFile = data.originalImageFile[0];
    let originalImageDataUri: string;
    try {
      originalImageDataUri = await fileToDataUri(imageFile);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Error al leer el archivo de imagen." });
      setIsLoading(false);
      return;
    }

    const aiInputParams: ReimaginedParams = {
      contextCulture: data.contextCulture,
      contextEntity: data.contextEntity,
      contextDetails: data.contextDetails,
      visualStyle: data.visualStyle,
      aspectRatio: data.aspectRatio,
      imageQuality: data.imageQuality,
      provider: data.provider,
      checkpoint: data.checkpoint,
    };

    try {
      let result;
      
      if (data.provider === 'stable-diffusion') {
        result = await reimagineWithStableDiffusion(originalImageDataUri, aiInputParams, data.checkpoint);
      } else {
        result = await reimagineUploadedImageAction({
          originalImage: originalImageDataUri,
          ...aiInputParams,
        });
      }
      
      setReimaginedImage(result.reimaginedImage);
      setDerivedPrompt(result.derivedPrompt);

      await addCreation(
        'reimagined',
        data.name,
        aiInputParams,
        { derivedPrompt: result.derivedPrompt },
        result.reimaginedImage,
        originalImageDataUri
      );
      toast({ title: "¡Imagen Reimaginada!", description: "Tu nueva creación se ha guardado en tu galería." });
    } catch (error: any) {
      console.error("Error reimagining image:", error);
      const errorMessage = error.message || "Error al reimaginar la imagen.";
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
            <Palette className="mr-3 h-10 w-10" />
            Reimagina Tu Imagen
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Sube una imagen y transfórmala con un nuevo contexto mitológico y estilo visual.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-lg">
            <CardHeader>
              <CardTitle>Definir Transformación</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de Nueva Creación</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Medusa Cyberpunk, Grifo Steampunk" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="originalImageFile"
                     render={({ field: { value, onChange, ...fieldProps } }) => (
                      <FormItem>
                        <FormLabel>Subir Imagen Original</FormLabel>
                        <FormControl>
                          <div className="flex items-center justify-center w-full">
                            <label htmlFor="dropzone-file-reimagine" className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer ${originalImagePreview ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {originalImagePreview ? (
                                        <>
                                        <CheckCircle className="w-8 h-8 mb-2 text-primary" />
                                        <p className="mb-1 text-sm text-primary"><span className="font-semibold">¡Imagen Seleccionada!</span></p>
                                        <p className="text-xs text-muted-foreground">{form.getValues("originalImageFile")?.[0]?.name}</p>
                                        </>
                                    ) : (
                                        <>
                                        <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                        <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Haz clic para subir</span></p>
                                        <p className="text-xs text-muted-foreground">Imagen original para transformar</p>
                                        </>
                                    )}
                                </div>
                                <Input id="dropzone-file-reimagine" type="file" className="hidden" accept="image/*" 
                                  {...fieldProps}
                                  onChange={handleImageChange}
                                />
                            </label>
                          </div> 
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <CardDescription>Contexto de Imagen Original:</CardDescription>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contextCulture"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cultura</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecciona cultura" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {MYTHOLOGICAL_CULTURES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contextEntity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entidad/Tema</FormLabel>
                          <FormControl><Input placeholder="Ej: Atenea, Esfinge" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                      control={form.control}
                      name="contextDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detalles Descriptivos</FormLabel>
                          <FormControl><Textarea placeholder="Detalles sobre el contexto de la imagen original" {...field} rows={2}/></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  
                  <CardDescription>Nuevos Parámetros Visuales:</CardDescription>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="visualStyle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nuevo Estilo Visual</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona nuevo estilo" /></SelectTrigger></FormControl>
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
                          <FormLabel>Nueva Relación de Aspecto</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona nueva relación de aspecto" /></SelectTrigger></FormControl>
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
                                <FormLabel>Nueva Calidad de Imagen</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona nueva calidad" /></SelectTrigger></FormControl>
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
                   {selectedProvider === 'stable-diffusion' && (
                    <FormField
                      control={form.control}
                      name="checkpoint"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Checkpoint Base (automático o manual)</FormLabel>
                          <FormControl>
                            <Input placeholder="Detectando checkpoint actual..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <Button type="submit" disabled={isLoading || !originalImagePreview} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Palette className="mr-2 h-4 w-4" />}
                    Reimaginar Imagen
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="shadow-lg">
              <CardHeader><CardTitle>Imagen Original</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center min-h-[200px]">
                {originalImagePreview ? (
                  <Image src={originalImagePreview} alt="Vista previa de imagen original" width={300} height={300} className="rounded-lg object-contain max-h-[250px]" data-ai-hint="uploaded image" />
                ) : (
                  <div className="text-center text-muted-foreground p-4 border-2 border-dashed rounded-lg">
                    <UploadCloud className="h-10 w-10 mx-auto mb-2" />
                    <p>Sube una imagen para ver la vista previa.</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader><CardTitle>Imagen Reimaginada</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[200px]">
                {isLoading && (
                  <div className="text-center text-muted-foreground">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-2" />
                    <p>Reimaginando...</p>
                  </div>
                )}
                {!isLoading && generationError && (
                  <div className="text-center text-destructive p-4 border-2 border-dashed border-destructive/50 rounded-lg">
                     <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
                    <p className="font-semibold">Error al Reimaginar</p>
                     <p className="text-sm mt-1">{generationError}</p>
                  </div>
                )}
                {!isLoading && !generationError && reimaginedImage && (
                  <Image src={reimaginedImage} alt="Imagen reimaginada" width={300} height={300} className="rounded-lg object-contain max-h-[250px] shadow-md" data-ai-hint="transformed art" />
                )}
                {!isLoading && !generationError && !reimaginedImage && (
                  <div className="text-center text-muted-foreground p-4 border-2 border-dashed rounded-lg">
                     <Palette className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>La nueva imagen aparecerá aquí.</p>
                  </div>
                )}
              </CardContent>
               {derivedPrompt && !isLoading && (
                <CardFooter className="flex-col items-start gap-2 border-t pt-4">
                  <h3 className="font-semibold">Prompt Derivado:</h3>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md break-words">{derivedPrompt}</p>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(derivedPrompt)}>
                    <Copy className="mr-2 h-4 w-4" /> Copiar Prompt
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
