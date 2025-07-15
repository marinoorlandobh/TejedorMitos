
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
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
  updateCreationNameAndParams: (id: string, newName: string, newParams: Creation['params']) => Promise<void>;
  updateCreationTranslatedStatus: (id: string, isTranslated: boolean) => Promise<void>;
  updateCreationImageAndOutput: (id: string, params: Creation['params'], newImageDataUri: string, newOutputData: GeneratedOutputData | ReimaginedOutputData) => Promise<Creation | undefined>;
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
          isTranslated: false, // Default to not translated
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

  const updateCreationNameAndParams = async (id: string, newName: string, newParams: Creation['params']) => {
    setLoading(true);
    setError(null);
    try {
      await db.creations.update(id, {
        name: newName,
        params: newParams,
        updatedAt: Date.now()
      });
      setLoading(false);
    } catch (e: any) {
      console.error("Failed to update creation name and params:", e);
      setError(e.message || "Failed to update name and params.");
      setLoading(false);
    }
  };

  const updateCreationTranslatedStatus = async (id: string, isTranslated: boolean) => {
    // This is a lightweight update, so we might not need a global loading state
    // unless the operation proves to be slow.
    try {
        await db.creations.update(id, { isTranslated, updatedAt: Date.now() });
    } catch (e: any) {
        console.error("Failed to update translated status:", e);
        setError(e.message || "Failed to update translated status.");
        // We might want to show a toast here instead of a global error
    }
  };
  
  const updateCreationImageAndOutput = useCallback(async (id: string, params: Creation['params'], newImageDataUri: string, newOutputData: GeneratedOutputData | ReimaginedOutputData): Promise<Creation | undefined> => {
    setLoading(true);
    setError(null);
    try {
        let updatedCreation: Creation | undefined;
        await db.transaction('rw', db.creations, db.imageDataStore, db.textOutputStore, async () => {
            const creation = await db.creations.get(id);
            if (!creation) throw new Error("Creation not found");

            // Delete old image and output
            if (creation.imageId) await db.imageDataStore.delete(creation.imageId);
            if (creation.outputId) await db.textOutputStore.delete(creation.outputId);
            
            // Add new image and output
            const newImageId = uuidv4();
            await db.imageDataStore.add({ id: newImageId, imageDataUri: newImageDataUri });

            const newOutputId = uuidv4();
            await db.textOutputStore.add({ id: newOutputId, data: newOutputData });

            // Prepare updates
            const updates: Partial<Creation> = {
                params,
                imageId: newImageId,
                outputId: newOutputId,
                updatedAt: Date.now(),
            };

            // Update the creation record
            await db.creations.update(id, updates);
            
            // Construct the full updated creation object to return
            updatedCreation = { ...creation, ...updates };
        });
        setLoading(false);
        return updatedCreation;
    } catch (e: any) {
        console.error("Failed to update creation data:", e);
        const errorMessage = e.message || "Failed to update creation data.";
        setError(errorMessage);
        setLoading(false);
        throw new Error(errorMessage);
    }
  }, []);

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
      const zip = new JSZip();
      
      const creationsData = await db.creations.toArray();
      const textOutputData = await db.textOutputStore.toArray();
      const allImageData = await db.imageDataStore.toArray();
      const imageCount = allImageData.length;

      const imageDataMetadata = [];
      const imagesFolder = zip.folder("images");
      if (!imagesFolder) {
        throw new Error("Could not create images folder in zip.");
      }

      for (const image of allImageData) {
        const { id, imageDataUri } = image;
        const match = imageDataUri.match(/^data:(image\/.*?);base64,(.*)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          const extension = mimeType.split('/')[1] || 'png';
          const fileName = `${id}.${extension}`;
          
          imagesFolder.file(fileName, base64Data, { base64: true });
          imageDataMetadata.push({ id, fileName, mimeType });
        }
      }

      const exportObject = {
        creations: creationsData,
        imageDataStore: imageDataMetadata,
        textOutputStore: textOutputData,
      };

      zip.file("data.json", JSON.stringify(exportObject, null, 2));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mythweaver_backup_${imageCount}_images_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLoading(false);
    } catch (e: any) {
      console.error("Failed to export data:", e);
      setError(e.message || "Failed to export data.");
      setLoading(false);
      throw e;
    }
  };
  
  const importData = async (file: File, mode: 'merge' | 'replace'): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      if (file.name.endsWith('.zip') || file.type === 'application/zip') {
        // Handle ZIP import (new format)
        const zip = await JSZip.loadAsync(file);
        const dataFile = zip.file('data.json');
        if (!dataFile) {
          throw new Error("El archivo data.json no se encontró en el archivo ZIP.");
        }
        
        const jsonStr = await dataFile.async('string');
        const importObj = JSON.parse(jsonStr);

        if (!importObj.creations || !importObj.imageDataStore || !importObj.textOutputStore) {
          throw new Error("Formato de archivo de respaldo no válido. El archivo data.json no contiene las secciones requeridas.");
        }

        const imagesFolder = zip.folder("images");
        if (!imagesFolder) {
          throw new Error("La carpeta 'images' no se encontró en el archivo ZIP.");
        }

        const newImageDataStore: ImageDataModel[] = [];
        for (const imageMeta of importObj.imageDataStore) {
          const { id, fileName, mimeType } = imageMeta;
          const imageFile = imagesFolder.file(fileName);
          if (imageFile) {
            const base64Data = await imageFile.async('base64');
            const imageDataUri = `data:${mimeType};base64,${base64Data}`;
            newImageDataStore.push({ id, imageDataUri });
          } else {
            console.warn(`Image file ${fileName} not found in zip for id ${id}. Skipping.`);
          }
        }

        await db.transaction('rw', db.creations, db.imageDataStore, db.textOutputStore, async () => {
          if (mode === 'replace') {
            await db.creations.clear();
            await db.imageDataStore.clear();
            await db.textOutputStore.clear();
          }
          await db.creations.bulkPut(importObj.creations as Creation[]);
          await db.imageDataStore.bulkPut(newImageDataStore);
          await db.textOutputStore.bulkPut(importObj.textOutputStore as TextOutputModel[]);
        });

      } else if (file.name.endsWith('.json') || file.type === 'application/json') {
        // Handle JSON import (old format)
        const jsonStr = await file.text();
        if (!jsonStr || !jsonStr.trim()) {
            throw new Error("El archivo JSON está vacío o no se pudo leer correctamente.");
        }
        const importObj = JSON.parse(jsonStr);

        if (!importObj.creations || !importObj.imageDataStore || !importObj.textOutputStore) {
          throw new Error("Formato de archivo de respaldo JSON no válido. Faltan secciones requeridas.");
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
      } else {
        throw new Error("Tipo de archivo no soportado. Por favor, selecciona un archivo .zip o .json.");
      }

    } catch (e: any) {
      console.error("Failed to import data:", e);
      const errorMessage = e.message || "Error al importar datos. Verifique el formato e integridad del archivo.";
      setError(errorMessage);
      throw new Error(errorMessage);
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
    <HistoryContext.Provider value={{ creations, addCreation, updateCreationName, updateCreationParams, updateCreationNameAndParams, updateCreationTranslatedStatus, updateCreationImageAndOutput, deleteCreation, getCreationById, getImageData, getTextOutput, exportData, importData, clearAllData, loading, error }}>
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
