
import Dexie, { type Table } from 'dexie';
import type { Creation, ImageDataModel, TextOutputModel } from './types';

export class MythWeaverDB extends Dexie {
  creations!: Table<Creation, string>; // string is the type of the primary key (id)
  imageDataStore!: Table<ImageDataModel, string>;
  textOutputStore!: Table<TextOutputModel, string>;

  constructor() {
    super('MythWeaverDB');
    this.version(1).stores({
      creations: '++id, name, type, createdAt, updatedAt, imageId, outputId, originalImageId',
      imageDataStore: '++id',
      textOutputStore: '++id',
    });
    // Add new version for the new 'isTranslated' field
    this.version(2).stores({
      creations: '++id, name, type, createdAt, updatedAt, imageId, outputId, originalImageId, isTranslated',
    });
  }
}

export const db = new MythWeaverDB();
