export type ScenePromptInput = {
  description: string;
  characterIds: string[];
  locationTag: string;
  propTags: string[];
};

export type ScenePromptResult = {
  prompt: string;
  negativePrompts: string[];
  characterIds: string[];
  locationTag: string;
  propTags: string[];
  canonWarnings: string[];
};
