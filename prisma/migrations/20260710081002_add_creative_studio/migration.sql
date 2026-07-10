-- CreateEnum
CREATE TYPE "StoryEpisodeStatus" AS ENUM ('draft', 'ready');

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('planned', 'prompted', 'queued', 'rendering', 'rendered', 'failed');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('image');

-- CreateEnum
CREATE TYPE "RenderJobKind" AS ENUM ('image');

-- CreateEnum
CREATE TYPE "RenderJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'retrying');

-- CreateTable
CREATE TABLE "StoryEpisode" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "logline" TEXT NOT NULL,
    "theme" TEXT,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" "StoryEpisodeStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryScene" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "dialogue" JSONB,
    "durationSeconds" INTEGER NOT NULL,
    "characterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locationTag" TEXT,
    "propTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imagePrompt" TEXT,
    "negativePrompts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SceneStatus" NOT NULL DEFAULT 'planned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedAsset" (
    "id" TEXT NOT NULL,
    "type" "AssetType" NOT NULL DEFAULT 'image',
    "scene_id" TEXT,
    "project_id" TEXT,
    "prompt" TEXT NOT NULL,
    "negativePrompts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "provider" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "contentHash" TEXT NOT NULL,
    "characterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locationTag" TEXT,
    "propTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reused" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "kind" "RenderJobKind" NOT NULL DEFAULT 'image',
    "status" "RenderJobStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "resultAssetId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostEstimate" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "imageCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voiceCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "videoCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakdown" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryEpisode_project_id_created_at_idx" ON "StoryEpisode"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "StoryScene_episode_id_index_idx" ON "StoryScene"("episode_id", "index");

-- CreateIndex
CREATE INDEX "GeneratedAsset_contentHash_idx" ON "GeneratedAsset"("contentHash");

-- CreateIndex
CREATE INDEX "GeneratedAsset_project_id_locationTag_idx" ON "GeneratedAsset"("project_id", "locationTag");

-- CreateIndex
CREATE INDEX "RenderJob_status_queuedAt_idx" ON "RenderJob"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "CostEstimate_episode_id_created_at_idx" ON "CostEstimate"("episode_id", "created_at");

-- AddForeignKey
ALTER TABLE "StoryScene" ADD CONSTRAINT "StoryScene_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "StoryEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAsset" ADD CONSTRAINT "GeneratedAsset_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "StoryScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "StoryScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEstimate" ADD CONSTRAINT "CostEstimate_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "StoryEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
