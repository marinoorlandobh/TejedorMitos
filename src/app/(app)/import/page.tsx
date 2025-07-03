
"use client";

import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileText, UploadCloud, Loader2, Sparkles, Wand2, Copy } from 'lucide-react';

// Set worker path. IMPORTANT: This is needed for pdf.js to work in the browser.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ExtractMythologiesOutput } from '@/ai/flows/extract-mythologies-flow';
import { extractMythologiesAction } from '@/lib/actions';

export default function ImportPdfPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<ExtractMythologiesOutput | null>(null);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
            setAnalysisResult(null);
            setExtractedText(null);
            setIsProcessingPdf(true);
            toast({ title: "Procesando PDF...", description: "Extrayendo texto del archivo." });
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map((item: any) => item.str).join(' ');
                }
                setExtractedText(text);
                toast({ title: "Texto Extraído", description: "El PDF se ha procesado. Ahora puedes generar los prompts." });
            } catch (error) {
                console.error("Error extracting text from PDF:", error);
                toast({ variant: "destructive", title: "Error", description: "No se pudo extraer el texto del PDF." });
                setPdfFile(null);
            } finally {
                setIsProcessingPdf(false);
            }
        } else if (file) {
            toast({ variant: "destructive", title: "Archivo no válido", description: "Por favor, selecciona un archivo PDF." });
            setPdfFile(null);
        }
    };

    const handleAnalyzeText = async () => {
        if (!extractedText) {
            toast({ variant: "destructive", title: "No hay texto", description: "Primero extrae el texto de un PDF." });
            return;
        }
        setIsLoading(true);
        setAnalysisResult(null);
        try {
            const result = await extractMythologiesAction({ text: extractedText });
            setAnalysisResult(result);
            toast({ title: "¡Análisis Completado!", description: "Se han generado mitologías y prompts a partir del texto." });
        } catch (error: any) {
            console.error("Error analyzing text:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo analizar el texto." });
        } finally {
            setIsLoading(false);
        }
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "¡Copiado!", description: "Prompt copiado al portapapeles." });
    };

    return (
        <ScrollArea className="h-full">
            <div className="container mx-auto p-4 md:p-8">
                <header className="mb-8">
                    <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
                        <FileText className="mr-3 h-10 w-10" />
                        Importar desde PDF
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">
                        Sube un archivo PDF para extraer textos y generar automáticamente mitologías y prompts.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>1. Subir PDF</CardTitle>
                            <CardDescription>Selecciona un archivo PDF para comenzar.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="pdf-upload" className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer ${pdfFile ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {isProcessingPdf ? (
                                            <>
                                                <Loader2 className="w-10 h-10 mb-3 text-primary animate-spin" />
                                                <p className="mb-2 text-sm text-primary"><span className="font-semibold">Procesando...</span></p>
                                            </>
                                        ) : pdfFile ? (
                                            <>
                                                <FileText className="w-10 h-10 mb-3 text-primary" />
                                                <p className="mb-2 text-sm text-primary"><span className="font-semibold">{pdfFile.name}</span></p>
                                                <p className="text-xs text-muted-foreground">Archivo seleccionado. ¡Listo para analizar!</p>
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                                                <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                                                <p className="text-xs text-muted-foreground">Solo archivos .PDF</p>
                                            </>
                                        )}
                                    </div>
                                    <Input id="pdf-upload" type="file" className="hidden" accept="application/pdf" onChange={handleFileChange} ref={fileInputRef} disabled={isProcessingPdf} />
                                </label>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleAnalyzeText} disabled={!extractedText || isLoading || isProcessingPdf} className="w-full">
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                2. Generar Prompts desde el Texto
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="shadow-lg flex flex-col">
                        <CardHeader>
                            <CardTitle>Resultados de la Generación</CardTitle>
                            <CardDescription>Las mitologías y prompts extraídos por la IA aparecerán aquí.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <ScrollArea className="h-full max-h-[400px] pr-3">
                                {isLoading && (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                                        <p className="text-lg">Analizando texto y generando ideas...</p>
                                    </div>
                                )}
                                {!isLoading && analysisResult && analysisResult.extractedData.length > 0 && (
                                    <Accordion type="single" collapsible className="w-full">
                                        {analysisResult.extractedData.map((myth, index) => (
                                            <AccordionItem value={`item-${index}`} key={index}>
                                                <AccordionTrigger>{myth.mythologyName}</AccordionTrigger>
                                                <AccordionContent>
                                                    <ul className="space-y-3">
                                                        {myth.prompts.map((prompt, pIndex) => (
                                                            <li key={pIndex} className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md flex justify-between items-center gap-2">
                                                                <span className="flex-1">{prompt}</span>
                                                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(prompt)} title="Copiar prompt" className="shrink-0">
                                                                    <Copy className="h-4 w-4" />
                                                                </Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                                {!isLoading && analysisResult && analysisResult.extractedData.length === 0 && (
                                    <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg h-full flex flex-col justify-center items-center">
                                        <Wand2 className="h-12 w-12 mx-auto mb-2" />
                                        <p>La IA no pudo extraer mitologías estructuradas del texto. Intenta con otro PDF.</p>
                                    </div>
                                )}
                                {!isLoading && !analysisResult && (
                                    <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg h-full flex flex-col justify-center items-center">
                                        <Wand2 className="h-12 w-12 mx-auto mb-2" />
                                        <p>Los resultados de la IA se mostrarán aquí.</p>
                                    </div>
                                )}
                             </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </ScrollArea>
    );
}
