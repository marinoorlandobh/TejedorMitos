"use client";

import React, { useState, useRef } from 'react';
import { Settings as SettingsIcon, Download, Upload, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useHistory } from '@/contexts/HistoryContext';
import { useToast } from '@/hooks/use-toast';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SettingsPage() {
  const { exportData, importData, clearAllData, loading, error } = useHistory();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  const handleExport = async () => {
    await exportData();
    if (!error && !loading) { 
       toast({ title: "Exportación Exitosa", description: "Los datos de tu galería han sido descargados." });
    } else if(error) {
       toast({ variant: "destructive", title: "Exportación Fallida", description: error });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await importData(file, importMode);
      if (!error && !loading) {
        toast({ title: "Importación Exitosa", description: `Los datos de la galería han sido ${importMode === 'merge' ? 'fusionados' : 'reemplazados'}.` });
      } else if(error) {
        toast({ variant: "destructive", title: "Importación Fallida", description: error });
      }
      
      if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  
  const handleClearAll = async () => {
    await clearAllData();
     if (!error && !loading) {
        toast({ title: "Datos Borrados", description: "Todos los datos de tu galería han sido eliminados." });
    } else if(error) {
       toast({ variant: "destructive", title: "Error al Borrar", description: error });
    }
  };

  return (
    <ScrollArea className="h-full">
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
          <SettingsIcon className="mr-3 h-10 w-10" />
          Ajustes
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Gestiona los datos y preferencias de tu aplicación Tejedor de Mitos.
        </p>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2"/> 
          <p>{error === "Failed to import data. Check file format and integrity." ? "Error al importar datos. Verifica el formato e integridad del archivo." : error === "Failed to read file." ? "Error al leer el archivo." : error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Download className="mr-2 h-5 w-5 text-primary" /> Exportar Datos</CardTitle>
            <CardDescription>Descarga tu galería completa (creaciones, imágenes y salidas de IA) como un archivo JSON para copia de seguridad o migración.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleExport} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar Mi Galería
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Upload className="mr-2 h-5 w-5 text-primary" /> Importar Datos</CardTitle>
            <CardDescription>Importa una galería previamente exportada desde un archivo JSON. Puedes elegir fusionar con los datos existentes o reemplazarlos por completo.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup defaultValue="merge" value={importMode} onValueChange={(value: 'merge' | 'replace') => setImportMode(value)} className="mb-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="merge" id="merge" />
                <Label htmlFor="merge">Fusionar con datos existentes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="replace" id="replace" />
                <Label htmlFor="replace">Reemplazar datos existentes</Label>
              </div>
            </RadioGroup>
            <Input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
          </CardContent>
          <CardFooter>
            <Button onClick={handleImportClick} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Importar Archivo de Galería
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive"><Trash2 className="mr-2 h-5 w-5" /> Borrar Todos los Datos</CardTitle>
            <CardDescription>Elimina permanentemente toda tu galería de este navegador. Esta acción no se puede deshacer. Exporta tus datos primero si quieres una copia de seguridad.</CardDescription>
          </CardHeader>
          <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={loading} className="w-full">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Borrar Todos Mis Datos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esto eliminará permanentemente todas tus creaciones, imágenes y salidas de IA almacenadas en este navegador. Esta acción es irreversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive hover:bg-destructive/90">
                    Sí, borrar todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </div>
    </div>
    </ScrollArea>
  );
}
