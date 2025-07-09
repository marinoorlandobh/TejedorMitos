
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import type { Creation, ImageDataModel, TextOutputModel, GeneratedParams, AnalyzedParams, ReimaginedParams, GeneratedOutputData, AnalyzedOutputData, ReimaginedOutputData } from '@/lib/types';

interface HistoryContextType {
  creations: Creation[];
  addCreation: (
    type: Creation['type'],
    name: string,
    params: Creation['params'],
    outputData: TextOutputModel['data'],
    imageDataUri?: string, // For generated/reimagined image
    originalImageDataUri?: string // For original image in analyzed/reimagined
  ) => Promise<{ creationId: string; imageId?: string; } | undefined>;
  updateCreationName: (id: string, newName: string) => Promise<void>;
  updateCreationParams: (id: string, newParams: Creation['params']) => Promise<void>;
  deleteCreation: (id: string) => Promise<void>;
  getCreationById: (id: string) => Promise<Creation | undefined>;
  getImageData: (id: string) => Promise<ImageDataModel | undefined>;
  getTextOutput: (id: string) => Promise<TextOutputModel | undefined>;
  exportData: () => Promise<void>;
  importData: (file: File, mode: 'merge' | 'replace') => Promise<void>;
  clearAllData: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-time data migration to fix encoding issues
  useEffect(() => {
    const runMigration = async () => {
      const migrationKey = 'data_migration_v3_fix_general_encoding'; // New key for the general fix
      if (localStorage.getItem(migrationKey)) {
        return; // Migration already done
      }

      console.log("Running one-time data migration to fix general encoding issues...");
      
      const fixEncoding = (str: string | undefined): string | undefined => {
          if (!str) return str;
          // This function handles common UTF-8 characters misinterpreted as ISO-8859-1/Windows-1252
          return str
              .replace(/Ã¡/g, 'á')
              .replace(/Ã©/g, 'é')
              .replace(/Ã­/g, 'í')
              .replace(/Ã³/g, 'ó')
              .replace(/Ãº/g, 'ú')
              .replace(/Ã±/g, 'ñ')
              .replace(/Ã/g, 'Á')
              .replace(/Ã‰/g, 'É')
              .replace(/Ã/g, 'Í')
              .replace(/Ã“/g, 'Ó')
              .replace(/Ãš/g, 'Ú')
              .replace(/Ã‘/g, 'Ñ')
              .replace(/Â¿/g, '¿')
              .replace(/Â¡/g, '¡')
              // Also fix the specific case of the replacement character if it's found
              .replace(/Nrdica/g, 'Nórdica');
      };

      try {
        await db.transaction('rw', db.creations, async () => {
          const creationsToFix = await db.creations.toArray();
          let updates = 0;

          for (const creation of creationsToFix) {
            let needsUpdate = false;
            
            const newName = fixEncoding(creation.name);
            const newParams = { ...creation.params } as any;

            if (newName !== creation.name) {
              needsUpdate = true;
            }

            // Fix all relevant string fields in params
            for (const key in newParams) {
              if (typeof newParams[key] === 'string') {
                const fixedValue = fixEncoding(newParams[key]);
                if (fixedValue !== newParams[key]) {
                  newParams[key] = fixedValue;
                  needsUpdate = true;
                }
              }
            }

            if (needsUpdate) {
              await db.creations.update(creation.id, { 
                name: newName,
                params: newParams, 
                updatedAt: Date.now() 
              });
              updates++;
            }
          }
          if (updates > 0) {
            console.log(`Migration successful: Updated ${updates} entries with encoding fixes.`);
          } else {
             console.log("Migration check complete: No entries needed encoding fixes.");
          }
        });
        
        localStorage.setItem(migrationKey, 'true');
      } catch (e) {
        console.error("Data migration for encoding fixes failed:", e);
      }
    };

    runMigration();
  }, []);

  const creations = useLiveQuery(
    () => db.creations.orderBy('createdAt').reverse().toArray(),
    [] // dependencies
  ) || [];

  const addCreation = useCallback(async (
    type: Creation['type'],
    name: string,
    params: Creation['params'],
    outputData: TextOutputModel['data'],
    imageDataUri?: string,
    originalImageDataUri?: string
  ): Promise<{ creationId: string; imageId?: string; } | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const creationId = uuidv4();
      let imageId: string | undefined = undefined;
      let originalImageId: string | undefined = undefined;
      const outputId = uuidv4();
      const now = Date.now();

      await db.transaction('rw', db.creations, db.imageDataStore, db.textOutputStore, async () => {
        // Handle main image (generated or reimagined result)
        if (imageDataUri) {
          imageId = uuidv4();
          await db.imageDataStore.add({ id: imageId, imageDataUri });
        }

        // Handle original image (for analyzed or reimagined source)
        if (originalImageDataUri) {
          originalImageId = uuidv4();
          // If it's an 'analyzed' type, this originalImageDataUri is the main image linked via imageId
          if (type === 'analyzed') {
            imageId = originalImageId;
          }
          await db.imageDataStore.add({ id: originalImageId, imageDataUri: originalImageDataUri });
        }
        
        await db.textOutputStore.add({ id: outputId, data: outputData });

        const newCreation: Creation = {
          id: creationId,
          name,
          type,
          createdAt: now,
          updatedAt: now,
          params,
          imageId,
          originalImageId: type === 'reimagined' ? originalImageId : undefined, // Only for reimagined
          outputId,
        };
        await db.creations.add(newCreation);
      });
      setLoading(false);
      return { creationId, imageId };
    } catch (e: any) {
      console.error("Failed to add creation:", e);
      setError(e.message || "Failed to save creation.");
      setLoading(false);
      return undefined;
    }
  }, []);

  const updateCreationName = async (id: string, newName: string) => {
    setLoading(true);
    setError(null);
    try {
      await db.creations.update(id, { name: newName, updatedAt: Date.now() });
      setLoading(false);
    } catch (e: any) {
      console.error("Failed to update creation name:", e);
      setError(e.message || "Failed to update name.");
      setLoading(false);
    }
  };

  const updateCreationParams = async (id: string, newParams: Creation['params']) => {
    setLoading(true);
    setError(null);
    try {
      await db.creations.update(id, { params: newParams, updatedAt: Date.now() });
      setLoading(false);
    } catch (e: any) {
      console.error("Failed to update creation params:", e);
      setError(e.message || "Failed to update params.");
      setLoading(false);
    }
  };

  const deleteCreation = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await db.transaction('rw', db.creations, db.imageDataStore, db.textOutputStore, async () => {
        const creation = await db.creations.get(id);
        if (creation) {
          if (creation.imageId) await db.imageDataStore.delete(creation.imageId);
          if (creation.originalImageId) await db.imageDataStore.delete(creation.originalImageId);
          if (creation.outputId) await db.textOutputStore.delete(creation.outputId);
          await db.creations.delete(id);
        }
      });
      setLoading(false);
    } catch (e: any) {
      console.error("Failed to delete creation:", e);
      setError(e.message || "Failed to delete creation.");
      setLoading(false);
    }
  };
  
  const getCreationById = async (id: string) => db.creations.get(id);
  const getImageData = async (id: string) => db.imageDataStore.get(id);
  const getTextOutput = async (id: string) => db.textOutputStore.get(id);

  const exportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const creationsData = await db.creations.toArray();
      const imageData = await db.imageDataStore.toArray();
      const textOutputData = await db.textOutputStore.toArray();
  
      const blobParts: (string | Blob)[] = [];
      blobParts.push('{');
  
      // Creations
      blobParts.push('"creations":[');
      creationsData.forEach((item, index) => {
        blobParts.push(JSON.stringify(item));
        if (index < creationsData.length - 1) blobParts.push(',');
      });
      blobParts.push('],');
  
      // Image Data
      blobParts.push('"imageDataStore":[');
      imageData.forEach((item, index) => {
        blobParts.push(JSON.stringify(item));
        if (index < imageData.length - 1) blobParts.push(',');
      });
      blobParts.push('],');
  
      // Text Output Data
      blobParts.push('"textOutputStore":[');
      textOutputData.forEach((item, index) => {
        blobParts.push(JSON.stringify(item));
        if (index < textOutputData.length - 1) blobParts.push(',');
      });
      blobParts.push(']');
  
      blobParts.push('}');
  
      const blob = new Blob(blobParts, { type: 'application/json' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mythweaver_backup_${new Date().toISOString().split('T')[0]}_${creationsData.length}_creaciones.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLoading(false);
    } catch (e: any) {
      console.error("Failed to export data:", e);
      setError(e.message || "Failed to export data.");
      setLoading(false);
      throw e; // Re-throw error to be caught by the caller
    }
  };
  
  const importData = async (file: File, mode: 'merge' | 'replace') => {
    setLoading(true);
    setError(null);
    try {
      const jsonStr = await file.text();
      if (!jsonStr) {
        throw new Error("El archivo está vacío o no se pudo leer.");
      }
      const importObj = JSON.parse(jsonStr);

      if (!importObj.creations || !importObj.imageDataStore || !importObj.textOutputStore) {
        throw new Error("Formato de archivo de respaldo no válido.");
      }

      await db.transaction('rw', db.creations, db.imageDataStore, db.textOutputStore, async () => {
        if (mode === 'replace') {
          await db.creations.clear();
          await db.imageDataStore.clear();
          await db.textOutputStore.clear();
        }
        await db.creations.bulkPut(importObj.creations as Creation[]);
        await db.imageDataStore.bulkPut(importObj.imageDataStore as ImageDataModel[]);
        await db.textOutputStore.bulkPut(importObj.textOutputStore as TextOutputModel[]);
      });
    } catch (e: any) {
      console.error("Failed to import data:", e);
      const errorMessage = e.message || "Error al importar datos. Verifique el formato e integridad del archivo.";
      setError(errorMessage);
      throw new Error(errorMessage); // Re-throw so the UI can catch it
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await db.transaction('rw', db.creations, db.imageDataStore, db.textOutputStore, async () => {
        await db.creations.clear();
        await db.imageDataStore.clear();
        await db.textOutputStore.clear();
      });
      setLoading(false);
    } catch (e: any) {
      console.error("Failed to clear data:", e);
      setError(e.message || "Failed to clear all data.");
      setLoading(false);
    }
  };

  return (
    <HistoryContext.Provider value={{ creations, addCreation, updateCreationName, updateCreationParams, deleteCreation, getCreationById, getImageData, getTextOutput, exportData, importData, clearAllData, loading, error }}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = (): HistoryContextType => {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};
