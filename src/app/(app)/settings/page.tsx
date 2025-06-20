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
    if (!error && !loading) { // Check error from context if it gets updated synchronously
       toast({ title: "Export Successful", description: "Your gallery data has been downloaded." });
    } else if(error) {
       toast({ variant: "destructive", title: "Export Failed", description: error });
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
        toast({ title: "Import Successful", description: `Gallery data has been ${importMode === 'merge' ? 'merged' : 'replaced'}.` });
      } else if(error) {
        toast({ variant: "destructive", title: "Import Failed", description: error });
      }
      // Reset file input
      if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  
  const handleClearAll = async () => {
    await clearAllData();
     if (!error && !loading) {
        toast({ title: "Data Cleared", description: "All your gallery data has been removed." });
    } else if(error) {
       toast({ variant: "destructive", title: "Clear Failed", description: error });
    }
  };

  return (
    <ScrollArea className="h-full">
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-headline font-bold text-primary flex items-center">
          <SettingsIcon className="mr-3 h-10 w-10" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Manage your Myth Weaver application data and preferences.
        </p>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2"/> 
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Download className="mr-2 h-5 w-5 text-primary" /> Export Data</CardTitle>
            <CardDescription>Download your entire gallery (creations, images, and AI outputs) as a JSON file for backup or migration.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleExport} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export My Gallery
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Upload className="mr-2 h-5 w-5 text-primary" /> Import Data</CardTitle>
            <CardDescription>Import a previously exported gallery from a JSON file. You can choose to merge with existing data or replace it entirely.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup defaultValue="merge" value={importMode} onValueChange={(value: 'merge' | 'replace') => setImportMode(value)} className="mb-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="merge" id="merge" />
                <Label htmlFor="merge">Merge with existing data</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="replace" id="replace" />
                <Label htmlFor="replace">Replace existing data</Label>
              </div>
            </RadioGroup>
            <Input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
          </CardContent>
          <CardFooter>
            <Button onClick={handleImportClick} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import Gallery File
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive"><Trash2 className="mr-2 h-5 w-5" /> Clear All Data</CardTitle>
            <CardDescription>Permanently delete your entire gallery from this browser. This action cannot be undone. Export your data first if you want a backup.</CardDescription>
          </CardHeader>
          <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={loading} className="w-full">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Clear All My Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your creations, images, and AI outputs stored in this browser. This action is irreversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive hover:bg-destructive/90">
                    Yes, delete everything
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
