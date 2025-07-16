
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useHistory } from '@/contexts/HistoryContext';
import { Library, Search, Loader2, Info, BookOpen, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Creation, TextOutputModel, GeneratedParams, AnalyzedParams, ReimaginedParams, GeneratedOutputData, AnalyzedOutputData, ReimaginedOutputData } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// --- Helper Functions similar to data-view ---
const getCulture = (c: Creation) => (c.params as any).culture || (c.params as any).mythologicalContext || (c.params as any).contextCulture || 'Sin Cultura';
const getEntity = (c: Creation) => (c.params as any).entity || (c.params as any).entityTheme || (c.params as any).contextEntity || 'Sin Entidad';

const getInputDetails = (c: Creation): string => {
    if (c.type === 'generated') return (c.params as GeneratedParams).details;
    if (c.type === 'reimagined') return (c.params as ReimaginedParams).contextDetails;
    if (c.type === 'analyzed') return (c.params as AnalyzedParams).additionalDetails || '';
    return '';
};

const OutputDetails: React.FC<{ creation: Creation }> = ({ creation }) => {
    const { getTextOutput } = useHistory();
    const [outputDetails, setOutputDetails] = useState<string | null>('Cargando...');

    useEffect(() => {
        let isActive = true;
        const fetchOutput = async () => {
            if (!creation.outputId) {
                setOutputDetails(null);
                return;
            }
            try {
                const textOutput = await getTextOutput(creation.outputId);
                if (isActive && textOutput) {
                    const data = textOutput.data;
                    if ((data as GeneratedOutputData).prompt) setOutputDetails((data as GeneratedOutputData).prompt);
                    else if ((data as ReimaginedOutputData).derivedPrompt) setOutputDetails((data as ReimaginedOutputData).derivedPrompt);
                    else if ((data as AnalyzedOutputData).analysis) setOutputDetails((data as AnalyzedOutputData).analysis);
                    else setOutputDetails(null);
                } else if (isActive) {
                    setOutputDetails(null);
                }
            } catch (e) {
                if (isActive) setOutputDetails('Error al cargar detalles.');
            }
        };
        fetchOutput();
        return () => { isActive = false; };
    }, [creation.id, creation.outputId, getTextOutput]);

    if (outputDetails === 'Cargando...') {
        return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /><span>Cargando salida...</span></div>;
    }
    
    if (!outputDetails) return null;

    return (
        <div className="mt-2 space-y-1">
            <h5 className="font-semibold text-xs text-primary/80">Salida de IA</h5>
            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md whitespace-pre-wrap">{outputDetails}</p>
        </div>
    );
};

// --- Main Page Component ---
export default function EncyclopediaPage() {
    const { creations, loading: historyLoading } = useHistory();
    const [searchTerm, setSearchTerm] = useState('');

    const encyclopediaData = useMemo(() => {
        const grouped: { [culture: string]: { [entity: string]: Creation[] } } = {};

        creations.forEach(c => {
            const culture = getCulture(c);
            const entity = getEntity(c);

            if (!grouped[culture]) {
                grouped[culture] = {};
            }
            if (!grouped[culture][entity]) {
                grouped[culture][entity] = [];
            }
            grouped[culture][entity].push(c);
            grouped[culture][entity].sort((a, b) => a.name.localeCompare(b.name));
        });

        // Sort cultures alphabetically
        const sortedCultures = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
        
        const finalData: { [culture: string]: { [entity: string]: Creation[] } } = {};
        sortedCultures.forEach(culture => {
             // Sort entities alphabetically
            const sortedEntities = Object.keys(grouped[culture]).sort((a, b) => a.localeCompare(b));
            const sortedEntitiesObject: { [entity: string]: Creation[] } = {};
            sortedEntities.forEach(entity => {
                sortedEntitiesObject[entity] = grouped[culture][entity];
            });
            finalData[culture] = sortedEntitiesObject;
        });
        
        return finalData;

    }, [creations]);
    
     const filteredData = useMemo(() => {
        if (!searchTerm) return encyclopediaData;
        const lowercasedFilter = searchTerm.toLowerCase();
        const filtered: { [culture: string]: { [entity: string]: Creation[] } } = {};

        for (const culture in encyclopediaData) {
            if (culture.toLowerCase().includes(lowercasedFilter)) {
                filtered[culture] = encyclopediaData[culture];
                continue;
            }
            
            const matchingEntities: { [entity: string]: Creation[] } = {};
            for (const entity in encyclopediaData[culture]) {
                if (entity.toLowerCase().includes(lowercasedFilter)) {
                    matchingEntities[entity] = encyclopediaData[culture][entity];
                    continue;
                }
                
                const matchingCreations = encyclopediaData[culture][entity].filter(
                    c => c.name.toLowerCase().includes(lowercasedFilter)
                );
                
                if (matchingCreations.length > 0) {
                    matchingEntities[entity] = matchingCreations;
                }
            }
            
            if (Object.keys(matchingEntities).length > 0) {
                filtered[culture] = matchingEntities;
            }
        }
        return filtered;
    }, [searchTerm, encyclopediaData]);


    if (historyLoading && creations.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <span className="ml-4 text-xl text-muted-foreground">Cargando Enciclopedia...</span>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="container mx-auto p-4 md:p-8">
                <header className="mb-8">
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
                            <Library className="mr-3 h-10 w-10" />
                            Enciclopedia
                        </h1>
                    </div>
                    <p className="text-muted-foreground mt-2 text-lg">
                        Un índice de solo texto de todas tus creaciones, organizado por cultura y entidad.
                    </p>
                </header>
                
                {creations.length === 0 && !historyLoading ? (
                    <Card className="text-center py-12 shadow-none border-dashed">
                         <CardHeader>
                            <Info className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                            <CardTitle className="text-2xl">La Enciclopedia está Vacía</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="text-lg">
                                Comienza a crear para poblar tu enciclopedia con mitos y leyendas.
                            </CardDescription>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="shadow-lg">
                        <CardHeader>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Buscar por cultura, entidad o nombre..."
                                    className="pl-10 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[65vh]">
                                <Accordion type="multiple" className="w-full">
                                    {Object.keys(filteredData).length > 0 ? Object.entries(filteredData).map(([culture, entities], cultureIndex) => (
                                        <AccordionItem value={`culture-${cultureIndex}`} key={cultureIndex}>
                                            <AccordionTrigger className="text-xl font-headline hover:no-underline">
                                                <div className="flex items-center gap-3">
                                                    <BookOpen className="h-6 w-6 text-primary/70" />
                                                    {culture}
                                                     <Badge variant="secondary">{Object.values(entities).reduce((acc, creations) => acc + creations.length, 0)}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <Accordion type="multiple" className="w-full pl-6 border-l ml-3">
                                                    {Object.entries(entities).map(([entity, creationList], entityIndex) => (
                                                        <AccordionItem value={`entity-${entityIndex}`} key={entityIndex} className="border-b-0">
                                                            <AccordionTrigger className="text-lg font-headline font-medium hover:no-underline">
                                                                 <div className="flex items-center gap-3">
                                                                     {entity}
                                                                     <Badge variant="outline">{creationList.length}</Badge>
                                                                 </div>
                                                            </AccordionTrigger>
                                                            <AccordionContent>
                                                                <div className="space-y-4 pl-6 border-l ml-3">
                                                                    {creationList.map(creation => (
                                                                        <div key={creation.id} className="pb-3 border-b last:border-b-0 border-dashed">
                                                                            <h4 className="font-semibold text-md flex items-center gap-2">
                                                                                <FileText className="h-4 w-4 text-accent"/>
                                                                                {creation.name}
                                                                            </h4>
                                                                            
                                                                            <div className="pl-6 space-y-2 mt-1">
                                                                                {getInputDetails(creation) && (
                                                                                    <div className="space-y-1">
                                                                                        <h5 className="font-semibold text-xs text-primary/80">Detalles de Entrada</h5>
                                                                                        <p className="text-sm text-muted-foreground">{getInputDetails(creation)}</p>
                                                                                    </div>
                                                                                )}
                                                                                <OutputDetails creation={creation} />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    ))}
                                                </Accordion>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )) : (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <p>No se encontraron resultados para "{searchTerm}".</p>
                                        </div>
                                    )}
                                </Accordion>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ScrollArea>
    );
}

    