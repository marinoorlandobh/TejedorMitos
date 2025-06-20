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
  ) => Promise<string | undefined>;
  updateCreationName: (id: string, newName: string) => Promise<void>;
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
  ): Promise<string| undefined> => {
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
      return creationId;
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
      const exportObj = { creations: creationsData, imageDataStore: imageData, textOutputStore: textOutputData };
      const jsonStr = JSON.stringify(exportObj);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mythweaver_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLoading(false);
    } catch (e: any) {
      console.error("Failed to export data:", e);
      setError(e.message || "Failed to export data.");
      setLoading(false);
    }
  };

  const importData = async (file: File, mode: 'merge' | 'replace') => {
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const importObj = JSON.parse(jsonStr);
        
        if (!importObj.creations || !importObj.imageDataStore || !importObj.textOutputStore) {
          throw new Error("Invalid backup file format.");
        }

        await db.transaction('rw', db.creations, db.imageDataStore, db.textOutputStore, async () => {
          if (mode === 'replace') {
            await db.creations.clear();
            await db.imageDataStore.clear();
            await db.textOutputStore.clear();
          }
          await db.creations.bulkAdd(importObj.creations as Creation[]);
          await db.imageDataStore.bulkAdd(importObj.imageDataStore as ImageDataModel[]);
          await db.textOutputStore.bulkAdd(importObj.textOutputStore as TextOutputModel[]);
        });
        setLoading(false);
      } catch (e: any) {
        console.error("Failed to import data:", e);
        setError(e.message || "Failed to import data. Check file format and integrity.");
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setLoading(false);
    };
    reader.readAsText(file);
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
    <HistoryContext.Provider value={{ creations, addCreation, updateCreationName, deleteCreation, getCreationById, getImageData, getTextOutput, exportData, importData, clearAllData, loading, error }}>
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
