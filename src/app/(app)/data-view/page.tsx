
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useHistory } from '@/contexts/HistoryContext';
import { List, Search, Download, Loader2, Info, Edit3, Save, X, Languages, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Creation, TextOutputModel, GeneratedParams, AnalyzedParams, ReimaginedParams, GeneratedOutputData, AnalyzedOutputData, ReimaginedOutputData } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Papa from 'papaparse';
import { Textarea } from '@/components/ui/textarea';
import { translateTextAction, translateCreationDetailsAction, regenerateCreationNameAction } from '@/lib/actions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const getCulture = (c: Creation) => (c.params as any).culture || (c.params as any).mythologicalContext || (c.params as any).contextCulture || 'N/A';
const getEntity = (c: Creation) => (c.params as any).entity || (c.params as any).entityTheme || (c.params as any).contextEntity || 'N/A';

const getInputDetails = (c: Creation) => {
    if (c.type === 'generated') return (c.params as GeneratedParams).details;
    if (c.type === 'reimagined') return (c.params as ReimaginedParams).contextDetails;
    if (c.type === 'analyzed') return (c.params as AnalyzedParams).additionalDetails || '';
    return '';
};

// This component fetches and displays the output details for a single creation.
const OutputDetailsCell: React.FC<{ creation: Creation }> = ({ creation }) => {
    const { getTextOutput } = useHistory();
    const [outputDetails, setOutputDetails] = useState<string>('Cargando...');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isActive = true;
        const fetchOutput = async () => {
            if (!creation.outputId) {
                setOutputDetails('');
                setLoading(false);
                return;
            }
            try {
                const textOutput = await getTextOutput(creation.outputId);
                if (isActive && textOutput) {
                    const data = textOutput.data;
                    if ((data as GeneratedOutputData).prompt) setOutputDetails(`Prompt: ${(data as GeneratedOutputData).prompt}`);
                    else if ((data as ReimaginedOutputData).derivedPrompt) setOutputDetails(`Prompt Derivado: ${(data as ReimaginedOutputData).derivedPrompt}`);
                    else if ((data as AnalyzedOutputData).analysis) setOutputDetails(`Análisis: ${(data as AnalyzedOutputData).analysis}`);
                    else setOutputDetails('');
                } else if (isActive) {
                     setOutputDetails('');
                }
            } catch (e) {
                if (isActive) setOutputDetails('Error al cargar');
                console.error("Error fetching output details:", e);
            } finally {
                if (isActive) setLoading(false);
            }
        };

        fetchOutput();
        return () => { isActive = false; };
    }, [creation.id, creation.outputId, getTextOutput]);
    
    const inputDetails = getInputDetails(creation);
    
    if (loading) {
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    return (
        <>
            {inputDetails && <p className="text-foreground">{inputDetails}</p>}
            <p className={inputDetails ? 'mt-2 border-t pt-2' : ''}>{outputDetails}</p>
        </>
    );
};


export default function DataViewPage() {
    const { creations, updateCreationName, updateCreationParams, updateCreationTranslatedStatus, updateCreationNameAndParams, updateCreationNameAndEntity, loading: historyLoading } = useHistory();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    
    const [editingCell, setEditingCell] = useState<{ id: string; field: 'name' | 'details' } | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isRegeneratingName, setIsRegeneratingName] = useState(false);
    const [translatingId, setTranslatingId] = useState<string | null>(null);
    const [translationFilter, setTranslationFilter] = useState<'all' | 'translated' | 'untranslated'>('all');

    const filteredCreations = useMemo(() => {
        const creationsAfterTranslationFilter = creations.filter(c => {
            if (translationFilter === 'translated') return c.isTranslated;
            if (translationFilter === 'untranslated') return !c.isTranslated;
            return true; // 'all'
        });

        if (!searchTerm) return creationsAfterTranslationFilter;
        
        const lowercasedFilter = searchTerm.toLowerCase();
        return creationsAfterTranslationFilter.filter(c => 
            c.name.toLowerCase().includes(lowercasedFilter) ||
            c.type.toLowerCase().includes(lowercasedFilter) ||
            getCulture(c).toLowerCase().includes(lowercasedFilter) ||
            getEntity(c).toLowerCase().includes(lowercasedFilter)
        );
    }, [searchTerm, creations, translationFilter]);
    
    const handleExportToCsv = async () => {
        if (filteredCreations.length === 0) {
            toast({ variant: "destructive", title: "Sin datos", description: "No hay datos para exportar." });
            return;
        }

        const dataForCsv = filteredCreations.map(c => ({
            "Nombre": c.name,
            "Tipo": c.type,
            "Traducido": c.isTranslated ? "Sí" : "No",
            "Cultura/Contexto": getCulture(c),
            "Entidad/Tema": getEntity(c),
            "Detalles de Entrada": getInputDetails(c),
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

    const handleEditClick = (creation: Creation, field: 'name' | 'details') => {
        setEditingCell({ id: creation.id, field });
        if (field === 'name') {
            setEditingValue(creation.name);
        } else {
            setEditingValue(getInputDetails(creation));
        }
    };

    const handleCancelEdit = () => {
        setEditingCell(null);
        setEditingValue('');
    };

    const handleSaveEdit = async () => {
        if (!editingCell) return;
        setIsSaving(true);
        try {
            if (editingCell.field === 'name') {
                await updateCreationName(editingCell.id, editingValue);
            } else {
                const creation = creations.find(c => c.id === editingCell.id);
                if (creation) {
                    const newParams = { ...creation.params };
                    if (creation.type === 'generated') (newParams as GeneratedParams).details = editingValue;
                    if (creation.type === 'reimagined') (newParams as ReimaginedParams).contextDetails = editingValue;
                    if (creation.type === 'analyzed') (newParams as AnalyzedParams).additionalDetails = editingValue;
                    await updateCreationParams(editingCell.id, newParams);
                }
            }
            toast({ title: "Guardado", description: "La creación ha sido actualizada." });
            handleCancelEdit();
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error al guardar", description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTranslateInPlace = async () => {
        if (!editingValue) return;
        setIsTranslating(true);
        toast({ title: "Traduciendo...", description: "La IA está traduciendo el texto." });
        try {
            const { translatedText } = await translateTextAction({ text: editingValue });
            setEditingValue(translatedText);
            toast({ title: "¡Texto Traducido!" });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error de Traducción", description: e.message });
        } finally {
            setIsTranslating(false);
        }
    };
    
    const toggleTranslatedStatus = async (creation: Creation) => {
        const newStatus = !creation.isTranslated;
        await updateCreationTranslatedStatus(creation.id, newStatus);
        toast({
            title: newStatus ? "Marcado como Traducido" : "Marcado como No Traducido",
            duration: 2000
        });
    };

    const handleTranslateRow = async (creation: Creation) => {
        setTranslatingId(creation.id);
        toast({ title: "Traduciendo fila...", description: "La IA está procesando el nombre y los detalles." });
        try {
            const details = getInputDetails(creation);
            const result = await translateCreationDetailsAction({
                name: creation.name,
                details: details,
            });

            const newParams = { ...creation.params };
            if (creation.type === 'generated') (newParams as GeneratedParams).details = result.translatedDetails;
            if (creation.type === 'reimagined') (newParams as ReimaginedParams).contextDetails = result.translatedDetails;
            if (creation.type === 'analyzed') (newParams as AnalyzedParams).additionalDetails = result.translatedDetails;

            await updateCreationNameAndParams(creation.id, result.translatedName, newParams);
            await updateCreationTranslatedStatus(creation.id, true);

            toast({ title: "¡Fila Traducida!", description: "La creación ha sido actualizada." });

        } catch (e: any) {
            toast({ variant: "destructive", title: "Error de Traducción", description: e.message });
        } finally {
            setTranslatingId(null);
        }
    };

    const handleRegenerateName = async () => {
        if (!editingCell || editingCell.field !== 'name') return;
        
        const creation = creations.find(c => c.id === editingCell.id);
        if (!creation) return;

        const promptText = getInputDetails(creation);
        if (!promptText) {
            toast({ variant: "destructive", title: "Sin Prompt", description: "No hay prompt de entrada para regenerar el nombre." });
            return;
        }

        setIsRegeneratingName(true);
        toast({ title: "Regenerando nombre...", description: "La IA está creando un nuevo nombre para esta creación." });

        try {
            const result = await regenerateCreationNameAction({ promptText });
            await updateCreationNameAndEntity(creation.id, result.creationName, result.entity);
            setEditingValue(result.creationName); // Update the input field with the new name
            toast({ title: "¡Nombre Regenerado!", description: "Se ha actualizado el nombre y la entidad de la creación." });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error de Regeneración", description: e.message });
        } finally {
            setIsRegeneratingName(false);
        }
    };


    if (historyLoading && creations.length === 0) {
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
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
                            <List className="mr-3 h-10 w-10" />
                            Vista de Datos
                        </h1>
                        <Badge variant="secondary" className="text-lg">{filteredCreations.length}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-2 text-lg">
                        Explora, edita, traduce y exporta toda la información textual de tus creaciones.
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
                                            placeholder="Buscar por nombre, tipo, cultura o entidad..."
                                            className="pl-10 w-full"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Select value={translationFilter} onValueChange={(value: 'all' | 'translated' | 'untranslated') => setTranslationFilter(value)}>
                                    <SelectTrigger className="w-full sm:w-[200px]">
                                        <SelectValue placeholder="Filtrar por traducción" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="translated">Solo Traducidos</SelectItem>
                                        <SelectItem value="untranslated">Solo No Traducidos</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                            <TableHead className="w-[10%]">Cultura/Contexto</TableHead>
                                            <TableHead className="w-[15%]">Entidad/Tema</TableHead>
                                            <TableHead>Detalles / Salida IA</TableHead>
                                            <TableHead className="w-[10%] text-center">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCreations.map(creation => (
                                            <TableRow key={creation.id} className={cn(translatingId === creation.id && "opacity-50 pointer-events-none")}>
                                                <TableCell className="font-medium align-top group relative">
                                                    {editingCell?.id === creation.id && editingCell.field === 'name' ? (
                                                        <div className="space-y-2">
                                                            <Input value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="h-8" />
                                                            <div className="flex items-center gap-1">
                                                                <Button size="icon" className="h-6 w-6" onClick={handleSaveEdit} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin h-3 w-3" /> : <Save className="h-3 w-3" />}</Button>
                                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}><X className="h-3 w-3" /></Button>
                                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleTranslateInPlace} disabled={isTranslating} title="Traducir nombre">{isTranslating ? <Loader2 className="animate-spin h-3 w-3" /> : <Languages className="h-3 w-3" />}</Button>
                                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleRegenerateName} disabled={isRegeneratingName} title="Regenerar nombre con IA">{isRegeneratingName ? <Loader2 className="animate-spin h-3 w-3" /> : <Sparkles className="h-3 w-3" />}</Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {creation.name}
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => handleEditClick(creation, 'name')}><Edit3 className="h-4 w-4" /></Button>
                                                        </>
                                                    )}
                                                </TableCell>
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
                                                <TableCell className="text-xs text-muted-foreground align-top whitespace-pre-wrap group relative">
                                                   {editingCell?.id === creation.id && editingCell.field === 'details' ? (
                                                        <div className="space-y-2">
                                                            <Textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} rows={4} />
                                                            <div className="flex items-center gap-1">
                                                                <Button size="icon" className="h-6 w-6" onClick={handleSaveEdit} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin h-3 w-3" /> : <Save className="h-3 w-3" />}</Button>
                                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}><X className="h-3 w-3" /></Button>
                                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleTranslateInPlace} disabled={isTranslating} title="Traducir detalles">{isTranslating ? <Loader2 className="animate-spin h-3 w-3" /> : <Languages className="h-3 w-3" />}</Button>
                                                            </div>
                                                            <div className="mt-2 border-t pt-2">
                                                                <OutputDetailsCell creation={creation} />
                                                            </div>
                                                        </div>
                                                   ) : (
                                                       <>
                                                          <OutputDetailsCell creation={creation} />
                                                         {getInputDetails(creation) && (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => handleEditClick(creation, 'details')}><Edit3 className="h-4 w-4" /></Button>
                                                         )}
                                                       </>
                                                   )}
                                                </TableCell>
                                                <TableCell className="align-top text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => toggleTranslatedStatus(creation)}
                                                                    className={cn(
                                                                        "h-7 w-7",
                                                                        creation.isTranslated ? "text-primary hover:text-primary/80" : "text-muted-foreground/50 hover:text-muted-foreground"
                                                                    )}
                                                                >
                                                                    <Languages className="h-5 w-5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{creation.isTranslated ? "Marcar como no traducido" : "Marcar como traducido"}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                         <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleTranslateRow(creation)}
                                                                    disabled={translatingId === creation.id}
                                                                    className="h-7 w-7"
                                                                >
                                                                    {translatingId === creation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4 text-accent" />}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Traducir Nombre y Detalles</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </TableCell>
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
    );
}
