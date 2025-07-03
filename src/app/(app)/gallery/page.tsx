"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { GalleryVerticalEnd, Search, Trash2, Edit3, Copy, ExternalLink, Loader2, Info, Columns, Rows } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { useHistory } from '@/contexts/HistoryContext';
import type { Creation, ImageDataModel, TextOutputModel, GeneratedParams, AnalyzedParams, ReimaginedParams } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';


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
  const { creations, getImageData, getTextOutput, deleteCreation, updateCreationName, loading: historyLoading } = useHistory();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'createdAtDesc' | 'createdAtAsc' | 'nameAsc' | 'nameDesc'>('createdAtDesc');
  const [selectedCreation, setSelectedCreation] = useState<CreationFull | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const { toast } = useToast();
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const [itemsPerPage, setItemsPerPage] = useState(4);
  const [currentPage, setCurrentPage] = useState(1);
  const [numColumns, setNumColumns] = useState<number>(4);

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
  };

  const handleDelete = async (id: string) => {
    await deleteCreation(id);
    toast({ title: "Creación Eliminada", description: "El elemento ha sido eliminado de tu galería." });
  };

  const handleEditName = (creation: CreationFull) => {
    setNewName(creation.name);
    setIsEditingName(true);
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

  const renderParams = (params: Creation['params'], type: Creation['type']) => {
    const p = params as any; // To simplify access
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        {type === 'generated' && <>
          <p><strong>Cultura:</strong> {p.culture}</p>
          <p><strong>Entidad:</strong> {p.entity}</p>
          <p><strong>Estilo:</strong> {p.style}</p>
        </>}
        {type === 'analyzed' && <>
          <p><strong>Contexto:</strong> {p.mythologicalContext}</p>
          <p><strong>Entidad/Tema:</strong> {p.entityTheme}</p>
        </>}
        {type === 'reimagined' && <>
          <p><strong>Contexto Original:</strong> {p.contextCulture} - {p.contextEntity}</p>
          <p><strong>Nuevo Estilo:</strong> {p.visualStyle}</p>
        </>}
         <p><strong>Calidad:</strong> {p.imageQuality || 'N/D'}</p>
         <p><strong>Relación de Aspecto:</strong> {p.aspectRatio || 'N/D'}</p>
      </div>
    );
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
              <SelectLabel>Imágenes por página</SelectLabel>
              {ITEMS_PER_PAGE_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(numColumns)} onValueChange={(value) => setNumColumns(Number(value))}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Columnas" />
            </SelectTrigger>
            <SelectContent>
               <SelectLabel>Número de columnas</SelectLabel>
               {NUM_COLUMNS_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v} Columnas</SelectItem>)}
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
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(creation)}>
                      <ExternalLink className="mr-2 h-4 w-4" /> Ver
                    </Button>
                    <div className="flex items-center gap-1">
                      {['generated', 'reimagined'].includes(creation.type) && creation.outputId && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyPrompt(creation)}
                              disabled={copyingId === creation.id}
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
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
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
              <div className="mt-8 flex items-center justify-center gap-4">
                  <Button
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                  >
                      Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                  </span>
                  <Button
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                  >
                      Siguiente
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
                  <div className="flex items-center gap-2">
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="text-2xl font-bold" />
                    <Button size="sm" onClick={handleSaveName}>Guardar</Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditingName(false)}>Cancelar</Button>
                  </div>
                ) : (
                  <DialogTitle className="text-3xl flex items-center">
                    {selectedCreation.name}
                    <Button variant="ghost" size="icon" onClick={() => handleEditName(selectedCreation)} className="ml-2">
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
                    <Image src={selectedCreation.imageData.imageDataUri} alt={selectedCreation.name} width={400} height={400} className="rounded-lg shadow-md object-contain w-full" data-ai-hint="mythological art" />
                  ) : (
                    <p className="text-muted-foreground">No hay imagen asociada.</p>
                  )}
                  {selectedCreation.type === 'reimagined' && selectedCreation.originalImageData?.imageDataUri && (
                    <>
                      <h3 className="font-semibold text-lg text-primary mt-4">Imagen Original</h3>
                      <Image src={selectedCreation.originalImageData.imageDataUri} alt={`Original para ${selectedCreation.name}`} width={200} height={200} className="rounded-lg shadow-md object-contain w-full" data-ai-hint="source image" />
                    </>
                  )}
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-primary">Parámetros</h3>
                  <div className="bg-muted p-3 rounded-md">{renderParams(selectedCreation.params, selectedCreation.type)}</div>

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

  return <Image src={imageUrl} alt={alt} fill className="object-cover transition-transform duration-300 group-hover:scale-105" data-ai-hint="gallery art" />;
};
