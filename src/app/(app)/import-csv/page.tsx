
"use client";

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { FileSpreadsheet, UploadCloud, Loader2, Copy, Table as TableIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CsvData {
  headers: string[];
  rows: { [key: string]: string }[];
}

export default function ImportCsvPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [csvFileName, setCsvFileName] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<CsvData | null>(null);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
            setIsLoading(true);
            setCsvFileName(file.name);
            setParsedData(null);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    if (!e.target?.result) {
                        throw new Error("No se pudo leer el contenido del archivo.");
                    }
                    const buffer = e.target.result as ArrayBuffer;
                    // Usamos TextDecoder para un manejo más robusto de la codificación de caracteres.
                    const decoder = new TextDecoder('utf-8');
                    const text = decoder.decode(buffer);

                    Papa.parse(text, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            if (results.errors.length > 0) {
                                console.error("Parsing errors:", results.errors);
                                toast({ variant: "destructive", title: "Error de Análisis", description: "Hubo un problema al leer el archivo. Asegúrate de que esté guardado con codificación UTF-8." });
                                setIsLoading(false);
                                setCsvFileName(null);
                                return;
                            }

                            const headers = results.meta.fields || [];
                            if (headers.length === 0 || !results.data.length) {
                                toast({ variant: "destructive", title: "Archivo CSV vacío o inválido", description: "El archivo no contiene encabezados o filas de datos." });
                                setIsLoading(false);
                                setCsvFileName(null);
                                return;
                            }
                            setParsedData({ headers, rows: results.data as { [key: string]: string }[] });
                            setIsLoading(false);
                            toast({ title: "Archivo Procesado", description: "Se ha cargado y analizado el archivo CSV." });
                        },
                        error: (error: any) => {
                            console.error("Error parsing CSV:", error);
                            toast({ variant: "destructive", title: "Error de Análisis", description: "No se pudo procesar el archivo CSV. Intenta guardándolo con codificación UTF-8." });
                            setIsLoading(false);
                            setCsvFileName(null);
                        }
                    });
                } catch (err) {
                    console.error("Error decoding or parsing CSV:", err);
                    toast({ variant: "destructive", title: "Error de Análisis", description: "No se pudo procesar el archivo CSV. Asegúrate de que esté guardado con codificación UTF-8." });
                    setIsLoading(false);
                    setCsvFileName(null);
                }
            };

            reader.onerror = () => {
                toast({ variant: "destructive", title: "Error de Lectura", description: "No se pudo leer el archivo. Puede que esté dañado o tenga una codificación incorrecta." });
                setIsLoading(false);
                setCsvFileName(null);
            };

            reader.readAsArrayBuffer(file);

        } else if (file) {
            toast({ variant: "destructive", title: "Archivo no válido", description: "Por favor, selecciona un archivo .csv." });
            setCsvFileName(null);
        }
    };


    const handleCopyPrompts = () => {
        if (!parsedData || !parsedData.rows.length) {
            toast({
                variant: "destructive",
                title: "No hay datos para copiar",
                description: "Por favor, carga primero un archivo CSV.",
            });
            return;
        }

        const detailsHeader = parsedData.headers.find(h => h.toLowerCase().trim() === 'details');
        const cultureHeader = parsedData.headers.find(h => h.toLowerCase().trim() === 'culture');

        if (!detailsHeader) {
             toast({
                variant: "destructive",
                title: "No se pueden copiar los prompts",
                description: "Asegúrate de que tu CSV esté cargado y contenga una columna llamada 'details'.",
            });
            return;
        }
        
        let cultureWasCopied = false;

        const formattedPrompts = parsedData.rows.map(row => {
            const details = row[detailsHeader]?.trim();
            if (!details) return null;

            if (cultureHeader && row[cultureHeader]?.trim()) {
                const culture = row[cultureHeader].trim();
                cultureWasCopied = true;
                return `${culture};${details}`;
            }
            return details;
        }).filter(Boolean).join('\n');

        
        if (formattedPrompts) {
            navigator.clipboard.writeText(formattedPrompts);
            toast({
                title: "¡Prompts Copiados!",
                description: cultureWasCopied
                    ? "Se han copiado los prompts con el formato 'cultura;prompt'."
                    : "Los prompts están listos para ser pegados en Creación en Lote.",
            });
        } else {
             toast({
                variant: "destructive",
                title: "Sin Prompts",
                description: "No se encontraron prompts en la columna 'details' para copiar.",
            });
        }
    };

    const hasDetailsColumn = parsedData?.headers.some(h => h.toLowerCase().trim() === 'details');

    return (
        <ScrollArea className="h-full">
            <div className="container mx-auto p-4 md:p-8">
                <header className="mb-8">
                    <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
                        <FileSpreadsheet className="mr-3 h-10 w-10" />
                        Importar desde CSV
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">
                        Sube un archivo CSV con tus prompts para prepararlos para la creación en lote.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>1. Subir Archivo CSV</CardTitle>
                            <CardDescription>
                                El archivo debe contener una columna `details` y opcionalmente `culture`.
                                <br />
                                <strong className="text-foreground/90">Importante:</strong> Al guardar desde Excel, elige "Guardar como" y selecciona el formato <strong>"CSV UTF-8 (delimitado por comas)"</strong> para que las tildes se procesen correctamente.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <label htmlFor="csv-upload" className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer ${csvFileName ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-2">
                                    {isLoading ? (
                                        <Loader2 className="w-10 h-10 mb-3 text-primary animate-spin" />
                                    ) : csvFileName ? (
                                        <>
                                            <FileSpreadsheet className="w-10 h-10 mb-3 text-primary" />
                                            <p className="mb-2 text-sm text-primary font-semibold truncate max-w-full">{csvFileName}</p>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                                            <p className="text-xs text-muted-foreground">Solo archivos .csv</p>
                                        </>
                                    )}
                                </div>
                                <Input id="csv-upload" type="file" className="hidden" accept=".csv,text/csv" onChange={handleFileChange} ref={fileInputRef} disabled={isLoading} />
                            </label>
                        </CardContent>
                        <CardFooter>
                           <Button onClick={handleCopyPrompts} disabled={!parsedData || isLoading || !hasDetailsColumn} className="w-full">
                                <Copy className="mr-2 h-4 w-4" />
                                2. Copiar Prompts para Lote
                           </Button>
                        </CardFooter>
                    </Card>

                    <Card className="shadow-lg flex flex-col">
                        <CardHeader>
                            <CardTitle>Vista Previa de Datos</CardTitle>
                            <CardDescription>Se mostrarán las primeras filas de tu archivo CSV.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <ScrollArea className="h-full max-h-[400px] pr-3">
                                {parsedData ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {parsedData.headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {parsedData.rows.slice(0, 5).map((row, rowIndex) => (
                                                <TableRow key={rowIndex}>
                                                    {parsedData.headers.map(header => (
                                                        <TableCell key={header} className="max-w-[200px] truncate">{row[header]}</TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg h-full flex flex-col justify-center items-center">
                                        <TableIcon className="h-12 w-12 mx-auto mb-2" />
                                        <p>La vista previa de los datos aparecerá aquí.</p>
                                    </div>
                                )}
                             </ScrollArea>
                             {parsedData && parsedData.rows.length > 5 && (
                                <p className="text-sm text-muted-foreground mt-2 text-center">
                                    Mostrando 5 de {parsedData.rows.length} filas.
                                </p>
                             )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </ScrollArea>
    );
}
