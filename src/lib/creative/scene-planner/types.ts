import type { StoryDialogueLine } from "../story/types";

export type PlannedScene = {
  index: number;
  description: string;
  dialogue: StoryDialogueLine[];
  durationSeconds: number;
  characterIds: string[];
  locationTag: string;
  propTags: string[];
};

export type ScenePlan = {
  scenes: PlannedScene[];
  totalDurationSeconds: number;
};
