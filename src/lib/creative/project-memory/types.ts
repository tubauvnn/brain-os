export type ProjectCreativeAssetSummary = {
  id: string;
  type: string;
  path: string;
  prompt: string;
  locationTag: string | null;
  propTags: string[];
  characterIds: string[];
  reused: boolean;
  createdAt: string;
};

export type ProjectCreativeMemory = {
  projectId: string;
  locations: string[];
  props: string[];
  characterIds: string[];
  assets: ProjectCreativeAssetSummary[];
};
