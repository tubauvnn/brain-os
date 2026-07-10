export type RecordNewAssetInput = {
  sceneId?: string | null;
  projectId?: string | null;
  prompt: string;
  negativePrompts: string[];
  provider: string;
  imageBuffer: Buffer;
  mimeType: string;
  costUsd?: number;
  characterIds: string[];
  locationTag?: string | null;
  propTags: string[];
  metadata?: Record<string, unknown>;
};
