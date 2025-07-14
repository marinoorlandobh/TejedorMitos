
"use client";

import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ImageIcon, Sparkles, Loader2, UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useHistory } from '@/contexts/HistoryContext';
import { useToast } from '@/hooks/use-toast';
import { analyzeUploadedImageAction } from '@/lib/actions';
import type { AnalyzedParams } from '@/lib/types';
import { MYTHOLOGICAL_CULTURES } from '@/lib/types'; 
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const analyzeImageSchema = z.object({
  name: z.string().min(1, "El nombre del análisis es obligatorio.").max(100),
  imageFile: z.custom<FileList>(val => val instanceof FileList && val.length > 0, "Se requiere un archivo de imagen."),
  mythologicalContext: z.string().min(1, "El contexto mitológico es obligatorio."),
  entityTheme: z.string().min(1, "La entidad/tema es obligatoria.").max(150),
  additionalDetails: z.string().optional().default(""),
});

type AnalyzeImageFormData = z.infer<typeof analyzeImageSchema>;

// Helper function to convert File to Data URI
const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


export default function AnalyzeImagePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ analysis: string; visualStyle: string } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const { addCreation } = useHistory();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AnalyzeImageFormData>({
    resolver: zodResolver(analyzeImageSchema),
    defaultValues: {
      name: '',
      mythologicalContext: MYTHOLOGICAL_CULTURES[0],
      entityTheme: '',
      additionalDetails: '',
    },
  });

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      form.setValue("imageFile", files); 
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue("imageFile", new DataTransfer().files); 
      setUploadedImagePreview(null);
    }
  };
  

  async function onSubmit(data: AnalyzeImageFormData) {
    setIsLoading(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    if (!data.imageFile || data.imageFile.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, sube una imagen." });
      setIsLoading(false);
      return;
    }

    const imageFile = data.imageFile[0];
    let imageDataUri: string;
    try {
      imageDataUri = await fileToDataUri(imageFile);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Error al leer el archivo de imagen." });
      setIsLoading(false);
      return;
    }
    
    const aiInputParams: AnalyzedParams = {
      mythologicalContext: data.mythologicalContext,
      entityTheme: data.entityTheme,
      additionalDetails: data.additionalDetails,
    };

    try {
      const result = await analyzeUploadedImageAction({
        imageDataUri,
        ...aiInputParams
      });
      setAnalysisResult(result);

      await addCreation(
        'analyzed',
        data.name,
        aiInputParams,
        { analysis: result.analysis, visualStyle: result.visualStyle },
        undefined, 
        imageDataUri 
      );
      toast({ title: "¡Análisis Completado!", description: "El análisis de la imagen se ha guardado en tu galería." });
    } catch (error: any) {
      console.error("Error analyzing image:", error);
      const errorMessage = error.message || "Error al analizar la imagen.";
      setAnalysisError(errorMessage);
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
            <ImageIcon className="mr-3 h-10 w-10" />
            Analiza Tu Imagen
            <Sparkles className="ml-2 h-8 w-8 text-accent" />
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Sube una imagen y deja que la IA revele su estilo y posibles conexiones mitológicas.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Subir y Describir</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Análisis</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Estudio de Jarrón Antiguo, Análisis de Escultura de Dragón" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="imageFile"
                    render={({ field: { value, onChange, ...fieldProps } }) => ( 
                      <FormItem>
                        <FormLabel>Subir Imagen</FormLabel>
                        <FormControl>
                          <div className="flex items-center justify-center w-full">
                            <label htmlFor="dropzone-file" className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer ${uploadedImagePreview ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {uploadedImagePreview ? (
                                        <>
                                        <CheckCircle className="w-10 h-10 mb-3 text-primary" />
                                        <p className="mb-2 text-sm text-primary"><span className="font-semibold">¡Imagen Seleccionada!</span></p>
                                        <p className="text-xs text-muted-foreground">{form.getValues("imageFile")?.[0]?.name}</p>
                                        </>
                                    ) : (
                                        <>
                                        <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                                        <p className="text-xs text-muted-foreground">SVG, PNG, JPG o GIF (MAX. 800x400px)</p>
                                        </>
                                    )}
                                </div>
                                <Input id="dropzone-file" type="file" className="hidden" accept="image/*" 
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
                  
                  <FormField
                    control={form.control}
                    name="mythologicalContext"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contexto Mitológico</FormLabel>
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
                  <FormField
                    control={form.control}
                    name="entityTheme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entidad / Tema (orientativo)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Medusa, Yggdrasil, Anubis" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="additionalDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detalles Adicionales (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Cualquier aspecto específico en el que centrarse o información conocida." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading || !uploadedImagePreview} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Analizar Imagen
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-lg flex flex-col">
            <CardHeader>
              <CardTitle>Resultados del Análisis</CardTitle>
              <CardDescription>Las percepciones de la IA aparecerán aquí.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center space-y-4">
              {uploadedImagePreview && (
                <div className="w-full max-w-md aspect-video relative border rounded-lg overflow-hidden mb-4">
                  <Image src={uploadedImagePreview} alt="Vista previa de la imagen subida" fill className="object-contain" data-ai-hint="uploaded image" />
                </div>
              )}
              {isLoading && (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                  <p className="text-lg">Analizando imagen... por favor espera.</p>
                </div>
              )}
              {!isLoading && analysisError && (
                <div className="w-full text-center text-destructive p-4 border-2 border-dashed border-destructive/50 rounded-lg">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                  <p className="font-semibold">Error en el Análisis</p>
                  <p className="text-sm mt-1">{analysisError}</p>
                </div>
              )}
              {!isLoading && !analysisError && analysisResult && (
                <div className="w-full space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">Estilo Visual:</h3>
                    <p className="text-muted-foreground p-2 bg-muted rounded-md">{analysisResult.visualStyle}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Análisis Detallado:</h3>
                    <ScrollArea className="h-48">
                      <p className="text-muted-foreground p-2 bg-muted rounded-md whitespace-pre-wrap">{analysisResult.analysis}</p>
                    </ScrollArea>
                  </div>
                </div>
              )}
              {!isLoading && !analysisError && !analysisResult && !uploadedImagePreview && (
                 <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                  <p>Sube una imagen para comenzar el análisis.</p>
                </div>
              )}
               {!isLoading && !analysisError && !analysisResult && uploadedImagePreview && (
                 <div className="text-center text-muted-foreground p-8">
                  <p>Envía el formulario para obtener el análisis de la IA.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
