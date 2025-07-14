
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useHistory } from '@/contexts/HistoryContext';
import { List, Search, Download, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Creation, TextOutputModel, GeneratedParams, AnalyzedParams, ReimaginedParams, GeneratedOutputData, AnalyzedOutputData, ReimaginedOutputData } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Papa from 'papaparse';


interface EnrichedCreation extends Creation {
    textOutput?: TextOutputModel;
}

const getCulture = (c: EnrichedCreation) => (c.params as any).culture || (c.params as any).mythologicalContext || (c.params as any).contextCulture || 'N/A';
const getEntity = (c: EnrichedCreation) => (c.params as any).entity || (c.params as any).entityTheme || (c.params as any).contextEntity || 'N/A';

const getInputDetails = (c: EnrichedCreation) => {
    return (c.params as any).details || (c.params as any).additionalDetails || (c.params as any).contextDetails || '';
};

const getOutputDetails = (c: EnrichedCreation) => {
    if (c.textOutput) {
        const data = c.textOutput.data;
        if ((data as GeneratedOutputData).prompt) return `Prompt: ${(data as GeneratedOutputData).prompt}`;
        if ((data as ReimaginedOutputData).derivedPrompt) return `Prompt Derivado: ${(data as ReimaginedOutputData).derivedPrompt}`;
        if ((data as AnalyzedOutputData).analysis) return `Análisis: ${(data as AnalyzedOutputData).analysis}`;
    }
    return '';
};

const getFullDetails = (c: EnrichedCreation) => {
    const input = getInputDetails(c);
    const output = getOutputDetails(c);
    if (input && output) {
        return `Detalles: ${input}\n\n${output}`;
    }
    return input || output || 'N/A';
};


export default function DataViewPage() {
    const { creations, getTextOutput, loading: historyLoading } = useHistory();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [enrichedCreations, setEnrichedCreations] = useState<EnrichedCreation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            if (historyLoading) return;
            setIsLoading(true);
            const enriched = await Promise.all(
                creations.map(async (c) => {
                    let textOutput: TextOutputModel | undefined;
                    if (c.outputId) {
                        textOutput = await getTextOutput(c.outputId);
                    }
                    return { ...c, textOutput };
                })
            );
            setEnrichedCreations(enriched);
            setIsLoading(false);
        };

        fetchAllData();
    }, [creations, getTextOutput, historyLoading]);


    const filteredCreations = useMemo(() => {
        if (!searchTerm) return enrichedCreations;
        const lowercasedFilter = searchTerm.toLowerCase();
        return enrichedCreations.filter(c => 
            c.name.toLowerCase().includes(lowercasedFilter) ||
            c.type.toLowerCase().includes(lowercasedFilter) ||
            getCulture(c).toLowerCase().includes(lowercasedFilter) ||
            getEntity(c).toLowerCase().includes(lowercasedFilter) ||
            getFullDetails(c).toLowerCase().includes(lowercasedFilter)
        );
    }, [searchTerm, enrichedCreations]);
    
    const handleExportToCsv = () => {
        if (filteredCreations.length === 0) {
            toast({ variant: "destructive", title: "Sin datos", description: "No hay datos para exportar." });
            return;
        }

        const dataForCsv = filteredCreations.map(c => ({
            "Nombre": c.name,
            "Tipo": c.type,
            "Cultura/Contexto": getCulture(c),
            "Entidad/Tema": getEntity(c),
            "Detalles/Salida IA": getFullDetails(c),
            "Fecha Creación": new Date(c.createdAt).toISOString(),
        }));

        const csv = Papa.unparse(dataForCsv);
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mythweaver_dataview_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({ title: "Exportación Completa", description: "Los datos de la tabla se han descargado como un archivo CSV." });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <span className="ml-4 text-xl text-muted-foreground">Cargando Datos...</span>
            </div>
        );
    }
    

    return (
        <ScrollArea className="h-full">
            <div className="container mx-auto p-4 md:p-8">
                <header className="mb-8">
                    <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
                        <List className="mr-3 h-10 w-10" />
                        Vista de Datos
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">
                        Explora y exporta toda la información textual de tus creaciones.
                    </p>
                </header>
                
                 {creations.length === 0 && !historyLoading ? (
                    <Card className="text-center py-12 shadow-none border-dashed">
                        <CardHeader>
                        <Info className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                        <CardTitle className="text-2xl">No Hay Datos para Mostrar</CardTitle>
                        </CardHeader>
                        <CardContent>
                        <CardDescription className="text-lg">
                            Tu galería está vacía. ¡Comienza a crear para ver tus datos aquí!
                        </CardDescription>
                        </CardContent>
                        <CardFooter className="justify-center">
                        <Button asChild>
                            <a href="/create">Crear un Mito</a>
                        </Button>
                        </CardFooter>
                    </Card>
                ) : (
                    <Card className="shadow-lg">
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                                <div className="flex-grow w-full">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            type="search"
                                            placeholder="Buscar en todos los campos..."
                                            className="pl-10 w-full"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleExportToCsv} className="w-full sm:w-auto">
                                    <Download className="mr-2 h-4 w-4"/>
                                    Copiar Tabla como CSV
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[60vh]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="w-[15%]">Nombre</TableHead>
                                            <TableHead className="w-[10%]">Tipo</TableHead>
                                            <TableHead className="w-[15%]">Cultura/Contexto</TableHead>
                                            <TableHead className="w-[15%]">Entidad/Tema</TableHead>
                                            <TableHead>Detalles / Salida IA</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCreations.map(creation => (
                                            <TableRow key={creation.id}>
                                                <TableCell className="font-medium align-top">{creation.name}</TableCell>
                                                <TableCell className="align-top">
                                                    <Badge variant={
                                                        creation.type === 'generated' ? 'default' :
                                                        creation.type === 'analyzed' ? 'secondary' : 'outline'
                                                      } className="capitalize">
                                                        {creation.type === 'generated' ? 'generado' : creation.type === 'analyzed' ? 'analizado' : 'reimaginado'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="align-top">{getCulture(creation)}</TableCell>
                                                <TableCell className="align-top">{getEntity(creation)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground align-top whitespace-pre-wrap">{getFullDetails(creation)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {filteredCreations.length === 0 && (
                                     <div className="text-center py-12 text-muted-foreground">
                                        <p>No se encontraron resultados para "{searchTerm}".</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ScrollArea>
    )
}
