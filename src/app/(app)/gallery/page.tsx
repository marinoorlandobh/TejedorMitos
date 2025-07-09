
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { GalleryVerticalEnd, Search, Trash2, Edit3, Copy, ExternalLink, Loader2, Info, Wand2, ZoomIn, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Languages } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { useHistory } from '@/contexts/HistoryContext';
import type { Creation, ImageDataModel, TextOutputModel, GeneratedParams, AnalyzedParams, ReimaginedParams, ReimaginedOutputData, GeneratedOutputData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectLabel, SelectGroup } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CreateFromPromptDialog } from '@/components/CreateFromPromptDialog';
import { MYTHOLOGICAL_CULTURES, IMAGE_STYLES, ASPECT_RATIOS, IMAGE_QUALITIES } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { translateTextAction, generateMythImageAction, reimagineUploadedImageAction } from '@/lib/actions';


interface CreationFull extends Creation {
  imageData?: ImageDataModel;
  textOutput?: TextOutputModel;
  originalImageData?: ImageDataModel; // For reimagined items
}

const getGridColsClass = (cols: number): string => {
  switch (cols) {
    case 2: return 'sm:grid-cols-2';
    case 3: return 'sm:grid-cols-2 lg:grid-cols-3';
    case 4: return 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    case 5: return 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';
    case 6: return 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';
    default: return 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  }
};

const ITEMS_PER_PAGE_OPTIONS = [2, 4, 6, 8, 10, 20, 50, 100, 200, 300, 400, 500, 1000];
const NUM_COLUMNS_OPTIONS = [2, 3, 4, 5, 6];

export default function GalleryPage() {
  const { creations, getImageData, getTextOutput, deleteCreation, updateCreationName, updateCreationParams, updateCreationImageAndOutput, loading: historyLoading } = useHistory();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'createdAtDesc' | 'createdAtAsc' | 'nameAsc' | 'nameDesc'>('createdAtDesc');
  const [selectedCreation, setSelectedCreation] = useState<CreationFull | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [editedParams, setEditedParams] = useState<Creation['params'] | null>(null);
  const { toast } = useToast();
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [usingPromptId, setUsingPromptId] = useState<string | null>(null);
  const [promptToCreateFrom, setPromptToCreateFrom] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [itemsPerPage, setItemsPerPage] = useState(4);
  const [currentPage, setCurrentPage] = useState(1);
  const [numColumns, setNumColumns] = useState<number>(4);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const filteredAndSortedCreations = useMemo(() => {
    let filtered = creations.filter(creation =>
      creation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (creation.params as any).culture?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (creation.params as any).entity?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (creation.params as any).mythologicalContext?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creation.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortBy) {
      case 'createdAtAsc':
        filtered.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'nameAsc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'nameDesc':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'createdAtDesc':
      default:
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }
    return filtered;
  }, [creations, searchTerm, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedCreations.length / itemsPerPage);
  const paginatedCreations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedCreations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedCreations, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, itemsPerPage]);

  const handleViewDetails = async (creation: Creation) => {
    let imageData, textOutput, originalImageData;
    if (creation.imageId) imageData = await getImageData(creation.imageId);
    if (creation.outputId) textOutput = await getTextOutput(creation.outputId);
    if (creation.type === 'reimagined' && creation.originalImageId) {
      originalImageData = await getImageData(creation.originalImageId);
    }
    setSelectedCreation({ ...creation, imageData, textOutput, originalImageData });
    setIsDetailModalOpen(true);
    setIsEditingName(false);
    setIsEditingParams(false);
  };

  const handleDelete = async (id: string) => {
    await deleteCreation(id);
    toast({ title: "Creación Eliminada", description: "El elemento ha sido eliminado de tu galería." });
  };

  const handleEditName = () => {
    if (!selectedCreation) return;
    setNewName(selectedCreation.name);
    setIsEditingName(true);
  };
  
  const handleEditParams = () => {
    if (!selectedCreation) return;
    setEditedParams(JSON.parse(JSON.stringify(selectedCreation.params))); // Deep copy
    setIsEditingParams(true);
  };
  
  const handleCancelEditParams = () => {
    setIsEditingParams(false);
    setEditedParams(null);
  };

  const handleSaveParams = async () => {
    if (selectedCreation && editedParams) {
        await updateCreationParams(selectedCreation.id, editedParams);
        setSelectedCreation(prev => prev ? { ...prev, params: editedParams, updatedAt: Date.now() } : null);
        setIsEditingParams(false);
        setEditedParams(null);
        toast({ title: "Parámetros Actualizados", description: "La información de la creación ha sido cambiada." });
    }
  };


  const handleSaveName = async () => {
    if (selectedCreation && newName.trim() !== '') {
      await updateCreationName(selectedCreation.id, newName.trim());
      setSelectedCreation(prev => prev ? { ...prev, name: newName.trim(), updatedAt: Date.now() } : null);
      setIsEditingName(false);
      toast({ title: "Nombre Actualizado", description: "El nombre de la creación ha sido cambiado." });
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "¡Copiado!", description: `${type} copiado al portapapeles.` });
  };
  
  const handleCopyPrompt = async (creation: Creation) => {
    if (!creation.outputId) {
      toast({ variant: "destructive", title: "Error", description: "No se encontró un ID de salida para esta creación." });
      return;
    }
    setCopyingId(creation.id);
    try {
      const textOutput = await getTextOutput(creation.outputId);
      if (textOutput) {
        const prompt = (textOutput.data as any).prompt || (textOutput.data as any).derivedPrompt;
        if (prompt) {
          copyToClipboard(prompt, "Prompt");
        } else {
          toast({ variant: "destructive", title: "Error", description: "No se encontró un prompt para copiar." });
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo obtener la información del prompt." });
      }
    } catch (e) {
      console.error("Error copying prompt from gallery:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo copiar el prompt." });
    } finally {
      setCopyingId(null);
    }
  };

  const handleUsePrompt = async (creation: Creation) => {
    if (!creation.outputId) {
      toast({ variant: "destructive", title: "Error", description: "No se encontró un ID de salida para esta creación." });
      return;
    }
    setUsingPromptId(creation.id);
    try {
      const textOutput = await getTextOutput(creation.outputId);
      if (textOutput) {
        const prompt = (textOutput.data as any).prompt || (textOutput.data as any).derivedPrompt;
        if (prompt) {
          setPromptToCreateFrom(prompt);
          setIsCreateDialogOpen(true);
        } else {
          toast({ variant: "destructive", title: "Error", description: "No se encontró un prompt para usar." });
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo obtener la información del prompt." });
      }
    } catch (e) {
      console.error("Error using prompt from gallery:", e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo usar el prompt." });
    } finally {
      setUsingPromptId(null);
    }
  };

  const handleTranslate = async (field: keyof Creation['params'], textToTranslate: string) => {
    if (!textToTranslate || isTranslating) return;
    
    setIsTranslating(true);
    setTranslatingField(field as string);
    toast({ title: "Traduciendo...", description: "La IA está traduciendo el texto." });

    try {
        const result = await translateTextAction({ text: textToTranslate });
        
        setEditedParams(prev => {
            if (!prev) return null;
            const newParams = { ...prev };
            (newParams as any)[field] = result.translatedText;
            return newParams;
        });
        toast({ title: "¡Texto Traducido!", description: "El campo ha sido actualizado." });

    } catch (error: any) {
        console.error("Translation failed:", error);
        toast({ variant: "destructive", title: "Error de Traducción", description: error.message });
    } finally {
        setIsTranslating(false);
        setTranslatingField(null);
    }
  };
  
  const handleRegenerate = async () => {
    if (!selectedCreation || !editedParams) return;

    setIsRegenerating(true);
    toast({ title: "Regenerando imagen...", description: "Este proceso puede tardar unos segundos." });

    try {
        let newImageUrl: string;
        let newOutputData: GeneratedOutputData | ReimaginedOutputData;

        if (selectedCreation.type === 'generated') {
            const result = await generateMythImageAction(editedParams as GeneratedParams);
            newImageUrl = result.imageUrl;
            newOutputData = { prompt: result.prompt };
        } else if (selectedCreation.type === 'reimagined' && selectedCreation.originalImageId) {
            const originalImage = await getImageData(selectedCreation.originalImageId);
            if (!originalImage) throw new Error("No se pudo encontrar la imagen original para la regeneración.");
            
            const result = await reimagineUploadedImageAction({
                originalImage: originalImage.imageDataUri,
                ...(editedParams as ReimaginedParams),
            });
            newImageUrl = result.reimaginedImage;
            newOutputData = { derivedPrompt: result.derivedPrompt };
        } else {
            throw new Error("Este tipo de creación no se puede regenerar.");
        }

        const updatedCreation = await updateCreationImageAndOutput(
            selectedCreation.id,
            editedParams,
            newImageUrl,
            newOutputData
        );

        if (updatedCreation) {
            // Fetch all data again to refresh the modal view
            let imageData, textOutput, originalImageData;
            if (updatedCreation.imageId) imageData = await getImageData(updatedCreation.imageId);
            if (updatedCreation.outputId) textOutput = await getTextOutput(updatedCreation.outputId);
            if (updatedCreation.type === 'reimagined' && updatedCreation.originalImageId) {
                originalImageData = await getImageData(updatedCreation.originalImageId);
            }
            setSelectedCreation({ ...updatedCreation, imageData, textOutput, originalImageData });
            setIsEditingParams(false); // Exit edit mode on success
            setEditedParams(null);
        }

        toast({ title: "¡Regeneración Completa!", description: "La imagen y los datos de la creación han sido actualizados." });
    } catch (err: any) {
        toast({ variant: "destructive", title: "Error en la Regeneración", description: err.message });
    } finally {
        setIsRegenerating(false);
    }
  };

  const handleParamChange = (field: keyof Creation['params'], value: string) => {
    setEditedParams(prev => {
        if (!prev) return null;
        const newParams = { ...prev };
        (newParams as any)[field] = value;
        return newParams;
    });
  };

  if (historyLoading && creations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-xl text-muted-foreground">Cargando Galería...</span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
            <GalleryVerticalEnd className="mr-3 h-10 w-10" />
            Mi Galería
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Explora tu colección de creaciones míticas, análisis y reimaginaciones.
          </p>
        </header>

        <div className="mb-6 flex flex-col sm:flex-row flex-wrap gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre, cultura, entidad..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAtDesc">Fecha (Más recientes)</SelectItem>
              <SelectItem value="createdAtAsc">Fecha (Más antiguos)</SelectItem>
              <SelectItem value="nameAsc">Nombre (A-Z)</SelectItem>
              <SelectItem value="nameDesc">Nombre (Z-A)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Items por página" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Imágenes por página</SelectLabel>
                {ITEMS_PER_PAGE_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={String(numColumns)} onValueChange={(value) => setNumColumns(Number(value))}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Columnas" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                 <SelectLabel>Número de columnas</SelectLabel>
                 {NUM_COLUMNS_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v} Columnas</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {filteredAndSortedCreations.length === 0 ? (
          <Card className="text-center py-12 shadow-none border-dashed">
            <CardHeader>
              <Info className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <CardTitle className="text-2xl">Tu Galería está Vacía</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-lg">
                ¡Comienza creando un nuevo mito, analizando una imagen o reimaginando una!
              </CardDescription>
            </CardContent>
            <CardFooter className="justify-center">
              <Button asChild>
                <a href="/create">Crea Tu Primer Mito</a>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <>
            <div className={cn("grid grid-cols-1 gap-6", getGridColsClass(numColumns))}>
              {paginatedCreations.map((creation) => (
                <Card key={creation.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 group">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg leading-tight line-clamp-2 hover:text-primary transition-colors">{creation.name}</CardTitle>
                      <Badge variant={
                        creation.type === 'generated' ? 'default' :
                        creation.type === 'analyzed' ? 'secondary' : 'outline'
                      } className="capitalize shrink-0 ml-2">
                        {creation.type === 'generated' ? 'generado' : creation.type === 'analyzed' ? 'analizado' : 'reimaginado'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {(() => {
                        const p = creation.params as any;
                        const culture = p.culture || p.mythologicalContext || p.contextCulture;
                        const timeAgo = formatDistanceToNow(new Date(creation.createdAt), { addSuffix: true, locale: es });
                        if (culture) {
                          return (
                            <span className="truncate">
                              <span className="font-semibold">{culture}</span>
                              <span className="text-muted-foreground/80"> • {timeAgo}</span>
                            </span>
                          );
                        }
                        return timeAgo;
                      })()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative flex-grow flex items-center justify-center p-0 aspect-square bg-muted/30">
                    {creation.imageId ? (
                      <ImageItem imageId={creation.imageId} alt={creation.name} />
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">Sin vista previa de imagen.</div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-4 flex justify-between items-center">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(creation)} disabled={copyingId === creation.id || usingPromptId === creation.id}>
                      <ExternalLink className="mr-2 h-4 w-4" /> Ver
                    </Button>
                    <div className="flex items-center gap-1">
                      {['generated', 'reimagined'].includes(creation.type) && creation.outputId && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUsePrompt(creation)}
                                disabled={copyingId === creation.id || usingPromptId === creation.id}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {usingPromptId === creation.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Wand2 className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Crear desde Prompt</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopyPrompt(creation)}
                                disabled={copyingId === creation.id || usingPromptId === creation.id}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {copyingId === creation.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copiar Prompt</p>
                            </TooltipContent>
                          </Tooltip>
                        </>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" disabled={copyingId === creation.id || usingPromptId === creation.id}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Eliminar</p>
                            </TooltipContent>
                          </Tooltip>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Esto eliminará permanentemente "{creation.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(creation.id)} className="bg-destructive hover:bg-destructive/90">
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="icon"
                    aria-label="Ir a la primera página"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="icon"
                    aria-label="Ir a la página anterior"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground mx-2">
                    Página {currentPage} de {totalPages}
                </span>
                <Button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="icon"
                    aria-label="Ir a la página siguiente"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="icon"
                    aria-label="Ir a la última página"
                >
                    <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {selectedCreation && (
          <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh]">
              <ScrollArea className="max-h-[80vh] pr-6">
              <DialogHeader>
                {isEditingName ? (
                   <>
                    <DialogTitle className="sr-only">Editando: {selectedCreation.name}</DialogTitle>
                    <div className="flex items-center gap-2">
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="text-2xl font-bold" aria-label="Nuevo nombre de la creación" />
                      <Button size="sm" onClick={handleSaveName}>Guardar</Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingName(false)}>Cancelar</Button>
                    </div>
                  </>
                ) : (
                  <DialogTitle className="text-3xl flex items-center">
                    {selectedCreation.name}
                    <Button variant="ghost" size="icon" onClick={handleEditName} className="ml-2">
                      <Edit3 className="h-5 w-5" />
                    </Button>
                  </DialogTitle>
                )}
                <DialogDescription>
                  Tipo: <Badge variant="outline" className="capitalize">{selectedCreation.type === 'generated' ? 'generado' : selectedCreation.type === 'analyzed' ? 'analizado' : 'reimaginado'}</Badge> | Creado: {formatDistanceToNow(new Date(selectedCreation.createdAt), { addSuffix: true, locale: es })} | Actualizado: {formatDistanceToNow(new Date(selectedCreation.updatedAt), { addSuffix: true, locale: es })}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-primary">Imagen</h3>
                  {selectedCreation.imageData?.imageDataUri ? (
                    <div
                      className="relative group/zoom cursor-zoom-in"
                      onClick={() => setZoomedImageUrl(selectedCreation.imageData!.imageDataUri)}
                    >
                      <Image src={selectedCreation.imageData.imageDataUri} alt={selectedCreation.name} width={400} height={400} className="rounded-lg shadow-md object-contain w-full" data-ai-hint="mythological art" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/zoom:opacity-100 transition-opacity duration-300 rounded-lg">
                        <ZoomIn className="h-12 w-12 text-white" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No hay imagen asociada.</p>
                  )}
                  {selectedCreation.type === 'reimagined' && selectedCreation.originalImageData?.imageDataUri && (
                    <>
                      <h3 className="font-semibold text-lg text-primary mt-4">Imagen Original</h3>
                       <div
                        className="relative group/zoom cursor-zoom-in"
                        onClick={() => setZoomedImageUrl(selectedCreation.originalImageData!.imageDataUri)}
                      >
                        <Image src={selectedCreation.originalImageData.imageDataUri} alt={`Original para ${selectedCreation.name}`} width={200} height={200} className="rounded-lg shadow-md object-contain w-full" data-ai-hint="source image" />
                         <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/zoom:opacity-100 transition-opacity duration-300 rounded-lg">
                          <ZoomIn className="h-12 w-12 text-white" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg text-primary">Parámetros</h3>
                    {!isEditingParams && (
                      <Button variant="ghost" size="icon" onClick={handleEditParams}>
                        <Edit3 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>

                  {isEditingParams && editedParams ? (
                     <div className="bg-muted p-3 rounded-md space-y-4">
                      {(() => {
                          if (!selectedCreation) return null;
                          const p = editedParams as any;
                          const type = selectedCreation.type;

                          const renderTextField = (label: string, field: keyof Creation['params'], placeholder: string, withTranslation = false, isTextarea = false) => {
                              const Comp = isTextarea ? Textarea : Input;
                              return (
                                  <div>
                                      <Label htmlFor={field as string} className="text-sm font-medium text-foreground">{label}</Label>
                                      <div className="flex items-center gap-2">
                                          <Comp
                                              id={field as string}
                                              value={p[field] || ''}
                                              onChange={(e) => handleParamChange(field, e.target.value)}
                                              placeholder={placeholder}
                                              className="bg-background"
                                              rows={isTextarea ? 3 : undefined}
                                          />
                                          {withTranslation && (
                                              <Tooltip>
                                                  <TooltipTrigger asChild>
                                                      <Button
                                                          type="button"
                                                          variant="outline"
                                                          size="icon"
                                                          onClick={() => handleTranslate(field, p[field])}
                                                          disabled={isTranslating && translatingField === field}
                                                      >
                                                          {isTranslating && translatingField === field ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                                                      </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent><p>Traducir a Español</p></TooltipContent>
                                              </Tooltip>
                                          )}
                                      </div>
                                  </div>
                              );
                          };
                          
                          const renderSelectField = (label: string, field: keyof Creation['params'], options: readonly string[]) => (
                              <div>
                                  <Label htmlFor={field as string} className="text-sm font-medium text-foreground">{label}</Label>
                                  <Select value={p[field]} onValueChange={(value) => handleParamChange(field, value)}>
                                      <SelectTrigger id={field as string} className="bg-background"><SelectValue /></SelectTrigger>
                                      <SelectContent>{options.map(o => (<SelectItem key={o} value={o}>{o}</SelectItem>))}</SelectContent>
                                  </Select>
                              </div>
                          );

                          switch (type) {
                              case 'generated':
                                  const genParams = p as GeneratedParams;
                                  return (
                                      <div className="space-y-3">
                                          {renderSelectField('Cultura', 'culture', MYTHOLOGICAL_CULTURES)}
                                          {renderTextField('Entidad', 'entity', 'Ej: Zeus, Fénix', true)}
                                          {renderTextField('Detalles', 'details', 'Describe la escena...', true, true)}
                                          {renderSelectField('Estilo', 'style', IMAGE_STYLES)}
                                          {renderSelectField('Relación de Aspecto', 'aspectRatio', ASPECT_RATIOS)}
                                          {renderSelectField('Calidad', 'imageQuality', IMAGE_QUALITIES)}
                                      </div>
                                  );
                              case 'analyzed':
                                  return (
                                      <div className="space-y-3">
                                          {renderSelectField('Contexto Mitológico', 'mythologicalContext', MYTHOLOGICAL_CULTURES)}
                                          {renderTextField('Entidad/Tema', 'entityTheme', 'Ej: Medusa, Anubis', true)}
                                          {renderTextField('Detalles Adicionales', 'additionalDetails', 'Cualquier detalle extra...', false, true)}
                                      </div>
                                  );
                              case 'reimagined':
                                  const reimagineParams = p as ReimaginedParams;
                                  return (
                                      <div className="space-y-3">
                                          <Label className="text-base font-semibold text-primary/90">Contexto Original</Label>
                                          {renderSelectField('Cultura del Contexto', 'contextCulture', MYTHOLOGICAL_CULTURES)}
                                          {renderTextField('Entidad del Contexto', 'contextEntity', 'Ej: Atenea, Esfinge', true)}
                                          {renderTextField('Detalles del Contexto', 'contextDetails', 'Describe la escena original...', true, true)}
                                          <div className="border-t pt-3 mt-3">
                                            <Label className="text-base font-semibold text-primary">Nuevos Parámetros</Label>
                                          </div>
                                          {renderSelectField('Nuevo Estilo Visual', 'visualStyle', IMAGE_STYLES)}
                                          {renderSelectField('Nueva Relación de Aspecto', 'aspectRatio', ASPECT_RATIOS)}
                                          {renderSelectField('Nueva Calidad', 'imageQuality', IMAGE_QUALITIES)}
                                      </div>
                                  );
                              default:
                                  return null;
                          }
                      })()}
                      <div className="flex justify-end gap-2 mt-4 flex-wrap">
                        <Button variant="ghost" size="sm" onClick={handleCancelEditParams} disabled={isRegenerating}>Cancelar</Button>
                        <Button size="sm" onClick={handleSaveParams} disabled={isRegenerating}>Guardar Metadatos</Button>
                        {['generated', 'reimagined'].includes(selectedCreation.type) && (
                            <Button size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
                                {isRegenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Regenerar Imagen
                            </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted p-3 rounded-md">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {selectedCreation.type === 'generated' && (() => {
                          const p = selectedCreation.params as GeneratedParams;
                          return <>
                            <p><strong>Cultura:</strong> {p.culture}</p>
                            <p><strong>Entidad:</strong> {p.entity}</p>
                            <p><strong>Estilo:</strong> {p.style}</p>
                          </>;
                        })()}
                        {selectedCreation.type === 'analyzed' && (() => {
                          const p = selectedCreation.params as AnalyzedParams;
                          return <>
                            <p><strong>Contexto:</strong> {p.mythologicalContext}</p>
                            <p><strong>Entidad/Tema:</strong> {p.entityTheme}</p>
                          </>;
                        })()}
                        {selectedCreation.type === 'reimagined' && (() => {
                          const p = selectedCreation.params as ReimaginedParams;
                          return <>
                            <p><strong>Contexto Original:</strong> {p.contextCulture} - {p.contextEntity}</p>
                            <p><strong>Nuevo Estilo:</strong> {p.visualStyle}</p>
                          </>;
                        })()}
                        <p><strong>Calidad:</strong> {(selectedCreation.params as any).imageQuality || 'N/D'}</p>
                        <p><strong>Relación de Aspecto:</strong> {(selectedCreation.params as any).aspectRatio || 'N/D'}</p>
                      </div>
                    </div>
                  )}

                  {selectedCreation.textOutput && (
                    <>
                      <h3 className="font-semibold text-lg text-primary mt-2">Salida de IA</h3>
                      <div className="bg-muted p-3 rounded-md space-y-2">
                        {selectedCreation.type === 'generated' && (selectedCreation.textOutput.data as any).prompt && (
                          <div>
                            <p className="font-medium">Prompt Generado:</p>
                            <p className="text-sm text-muted-foreground break-words">{(selectedCreation.textOutput.data as any).prompt}</p>
                            <Button variant="outline" size="xs" className="mt-1" onClick={() => copyToClipboard((selectedCreation.textOutput!.data as any).prompt, "Prompt")}>
                              <Copy className="mr-1 h-3 w-3" /> Copiar
                            </Button>
                          </div>
                        )}
                        {selectedCreation.type === 'analyzed' && (
                          <>
                            <div>
                              <p className="font-medium">Estilo Visual:</p>
                              <p className="text-sm text-muted-foreground">{(selectedCreation.textOutput.data as any).visualStyle}</p>
                            </div>
                            <div>
                              <p className="font-medium">Análisis:</p>
                              <p className="text-sm text-muted-foreground break-words">{(selectedCreation.textOutput.data as any).analysis}</p>
                              <Button variant="outline" size="xs" className="mt-1" onClick={() => copyToClipboard((selectedCreation.textOutput!.data as any).analysis, "Análisis")}>
                                <Copy className="mr-1 h-3 w-3" /> Copiar
                              </Button>
                            </div>
                          </>
                        )}
                        {selectedCreation.type === 'reimagined' && (selectedCreation.textOutput.data as any).derivedPrompt && (
                           <div>
                            <p className="font-medium">Prompt Derivado:</p>
                            <p className="text-sm text-muted-foreground break-words">{(selectedCreation.textOutput.data as any).derivedPrompt}</p>
                            <Button variant="outline" size="xs" className="mt-1" onClick={() => copyToClipboard((selectedCreation.textOutput!.data as any).derivedPrompt, "Prompt")}>
                              <Copy className="mr-1 h-3 w-3" /> Copiar
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              </ScrollArea>
              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button variant="outline">Cerrar</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {zoomedImageUrl && (
          <Dialog open={!!zoomedImageUrl} onOpenChange={(open) => !open && setZoomedImageUrl(null)}>
            <DialogContent className="p-0 border-0 max-w-5xl bg-transparent shadow-none w-auto h-auto">
              <DialogTitle className="sr-only">Imagen Ampliada</DialogTitle>
              <Image src={zoomedImageUrl} alt="Imagen ampliada" width={1200} height={1200} className="rounded-lg object-contain w-auto h-auto max-w-[90vw] max-h-[90vh]" />
            </DialogContent>
          </Dialog>
        )}
        
        {promptToCreateFrom && (
            <CreateFromPromptDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                prompt={promptToCreateFrom}
            />
        )}
      </div>
    </ScrollArea>
  );
}

// Helper component to fetch and display image to avoid re-fetching on parent re-render
const ImageItem: React.FC<{ imageId: string, alt: string }> = ({ imageId, alt }) => {
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
    return <div className="w-full h-full flex items-center justify-center bg-muted/50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!imageUrl) {
    return <div className="w-full h-full flex items-center justify-center bg-muted/50 text-xs text-muted-foreground p-2">Imagen no encontrada</div>;
  }

  return <Image src={imageUrl} alt={alt} fill className="object-contain transition-transform duration-300 group-hover:scale-105" data-ai-hint="gallery art" />;
};
    
