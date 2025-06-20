"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { GalleryVerticalEnd, Search, Trash2, Edit3, Copy, ExternalLink, Loader2, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreationFull extends Creation {
  imageData?: ImageDataModel;
  textOutput?: TextOutputModel;
  originalImageData?: ImageDataModel; // For reimagined items
}

export default function GalleryPage() {
  const { creations, getImageData, getTextOutput, deleteCreation, updateCreationName, loading: historyLoading } = useHistory();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'createdAtDesc' | 'createdAtAsc' | 'nameAsc' | 'nameDesc'>('createdAtDesc');
  const [selectedCreation, setSelectedCreation] = useState<CreationFull | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const { toast } = useToast();

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
    toast({ title: "Creation Deleted", description: "The item has been removed from your gallery." });
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
      toast({ title: "Name Updated", description: "The creation's name has been changed." });
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${type} copied to clipboard.` });
  };

  const renderParams = (params: Creation['params'], type: Creation['type']) => {
    const p = params as any; // To simplify access
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        {type === 'generated' && <>
          <p><strong>Culture:</strong> {p.culture}</p>
          <p><strong>Entity:</strong> {p.entity}</p>
          <p><strong>Style:</strong> {p.style}</p>
        </>}
        {type === 'analyzed' && <>
          <p><strong>Context:</strong> {p.mythologicalContext}</p>
          <p><strong>Entity/Theme:</strong> {p.entityTheme}</p>
        </>}
        {type === 'reimagined' && <>
          <p><strong>Original Context:</strong> {p.contextCulture} - {p.contextEntity}</p>
          <p><strong>New Style:</strong> {p.visualStyle}</p>
        </>}
         <p><strong>Quality:</strong> {p.imageQuality || 'N/A'}</p>
         <p><strong>Aspect Ratio:</strong> {p.aspectRatio || 'N/A'}</p>
      </div>
    );
  };

  if (historyLoading && creations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-xl text-muted-foreground">Loading Gallery...</span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
            <GalleryVerticalEnd className="mr-3 h-10 w-10" />
            My Gallery
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Explore your collection of mythic creations, analyses, and reimaginations.
          </p>
        </header>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, culture, entity..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAtDesc">Date (Newest)</SelectItem>
              <SelectItem value="createdAtAsc">Date (Oldest)</SelectItem>
              <SelectItem value="nameAsc">Name (A-Z)</SelectItem>
              <SelectItem value="nameDesc">Name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredAndSortedCreations.length === 0 ? (
          <Card className="text-center py-12 shadow-none border-dashed">
            <CardHeader>
              <Info className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <CardTitle className="text-2xl">Your Gallery is Empty</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-lg">
                Start by creating a new myth, analyzing an image, or reimagining one!
              </CardDescription>
            </CardContent>
            <CardFooter className="justify-center">
              <Button asChild>
                <a href="/create">Create Your First Myth</a>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedCreations.map((creation) => (
              <Card key={creation.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg leading-tight line-clamp-2 hover:text-primary transition-colors">{creation.name}</CardTitle>
                    <Badge variant={
                      creation.type === 'generated' ? 'default' :
                      creation.type === 'analyzed' ? 'secondary' : 'outline'
                    } className="capitalize shrink-0 ml-2">
                      {creation.type}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {formatDistanceToNow(new Date(creation.createdAt), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center p-0 aspect-square bg-muted/30">
                  {creation.imageId ? (
                    <ImageItem imageId={creation.imageId} alt={creation.name} />
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">No image preview.</div>
                  )}
                </CardContent>
                <CardFooter className="pt-4 flex justify-between items-center">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetails(creation)}>
                    <ExternalLink className="mr-2 h-4 w-4" /> View
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete "{creation.name}".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(creation.id)} className="bg-destructive hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {selectedCreation && (
          <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh]">
              <ScrollArea className="max-h-[80vh] pr-6">
              <DialogHeader>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="text-2xl font-bold" />
                    <Button size="sm" onClick={handleSaveName}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditingName(false)}>Cancel</Button>
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
                  Type: <Badge variant="outline" className="capitalize">{selectedCreation.type}</Badge> | Created: {formatDistanceToNow(new Date(selectedCreation.createdAt), { addSuffix: true })} | Updated: {formatDistanceToNow(new Date(selectedCreation.updatedAt), { addSuffix: true })}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-primary">Image</h3>
                  {selectedCreation.imageData?.imageDataUri ? (
                    <Image src={selectedCreation.imageData.imageDataUri} alt={selectedCreation.name} width={400} height={400} className="rounded-lg shadow-md object-contain w-full" data-ai-hint="mythological art" />
                  ) : (
                    <p className="text-muted-foreground">No image associated.</p>
                  )}
                  {selectedCreation.type === 'reimagined' && selectedCreation.originalImageData?.imageDataUri && (
                    <>
                      <h3 className="font-semibold text-lg text-primary mt-4">Original Image</h3>
                      <Image src={selectedCreation.originalImageData.imageDataUri} alt={`Original for ${selectedCreation.name}`} width={200} height={200} className="rounded-lg shadow-md object-contain w-full" data-ai-hint="source image" />
                    </>
                  )}
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-primary">Parameters</h3>
                  <div className="bg-muted p-3 rounded-md">{renderParams(selectedCreation.params, selectedCreation.type)}</div>

                  {selectedCreation.textOutput && (
                    <>
                      <h3 className="font-semibold text-lg text-primary mt-2">AI Output</h3>
                      <div className="bg-muted p-3 rounded-md space-y-2">
                        {selectedCreation.type === 'generated' && (selectedCreation.textOutput.data as any).prompt && (
                          <div>
                            <p className="font-medium">Generated Prompt:</p>
                            <p className="text-sm text-muted-foreground break-words">{(selectedCreation.textOutput.data as any).prompt}</p>
                            <Button variant="outline" size="xs" className="mt-1" onClick={() => copyToClipboard((selectedCreation.textOutput!.data as any).prompt, "Prompt")}>
                              <Copy className="mr-1 h-3 w-3" /> Copy
                            </Button>
                          </div>
                        )}
                        {selectedCreation.type === 'analyzed' && (
                          <>
                            <div>
                              <p className="font-medium">Visual Style:</p>
                              <p className="text-sm text-muted-foreground">{(selectedCreation.textOutput.data as any).visualStyle}</p>
                            </div>
                            <div>
                              <p className="font-medium">Analysis:</p>
                              <p className="text-sm text-muted-foreground break-words">{(selectedCreation.textOutput.data as any).analysis}</p>
                              <Button variant="outline" size="xs" className="mt-1" onClick={() => copyToClipboard((selectedCreation.textOutput!.data as any).analysis, "Analysis")}>
                                <Copy className="mr-1 h-3 w-3" /> Copy
                              </Button>
                            </div>
                          </>
                        )}
                        {selectedCreation.type === 'reimagined' && (selectedCreation.textOutput.data as any).derivedPrompt && (
                           <div>
                            <p className="font-medium">Derived Prompt:</p>
                            <p className="text-sm text-muted-foreground break-words">{(selectedCreation.textOutput.data as any).derivedPrompt}</p>
                            <Button variant="outline" size="xs" className="mt-1" onClick={() => copyToClipboard((selectedCreation.textOutput!.data as any).derivedPrompt, "Prompt")}>
                              <Copy className="mr-1 h-3 w-3" /> Copy
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
                  <Button variant="outline">Close</Button>
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
    return <div className="w-full h-full flex items-center justify-center bg-muted/50 text-xs text-muted-foreground p-2">Image not found</div>;
  }

  return <Image src={imageUrl} alt={alt} layout="fill" objectFit="cover" className="transition-transform duration-300 group-hover:scale-105" data-ai-hint="gallery art" />;
};

