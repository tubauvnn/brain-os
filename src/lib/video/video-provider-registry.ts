import { openMontageAdapter } from "./providers/openmontage";
import { localPanZoomProvider } from "./providers/local-pan-zoom";
import type { VideoProvider } from "./provider-types";

// VideoProvider Registry — composition root, same pattern as
// src/lib/creative/image-provider/image-router.ts /
// src/lib/model/model-router.ts / src/lib/voice/voice-router.ts: the ONE
// place that knows which concrete VideoProvider implementations exist.
// Callers (scene-video-provider.ts) only ever call
// selectHealthyProvider() — they never import a concrete provider file
// directly, and never branch on provider name.
//
// OPEN MONTAGE IS ONE ADAPTER, NOT THE CENTER OF THIS ARCHITECTURE: it is
// registered here as an ordinary entry, first in preference order only
// because it can reach real downstream AI models when configured — it has
// no special status in the contract or the selection code. Swapping it out,
// removing it, or adding a direct provider (Veo/Kling/Wan/fal.ai/MiniMax
// calling their own REST APIs, bypassing OpenMontage entirely) is 1 file +
// 1 line here, same as adding any provider anywhere else in Brain OS.
//
// localPanZoomProvider is registered LAST as the guaranteed-available
// bottom rung (only needs the ffmpeg binary) — its presence in this same
// list, behind the same contract, is what makes "fall back to local
// rendering" NOT a special case: it's just the next provider in line.
const PROVIDERS: VideoProvider[] = [openMontageAdapter, localPanZoomProvider];

async function selectHealthyProvider(): Promise<VideoProvider | null> {
  for (const provider of PROVIDERS) {
    const health = await provider.healthCheck();
    if (health.available) return provider;
  }
  return null;
}

function listProviders(): VideoProvider[] {
  return PROVIDERS;
}

export const VideoProviderRegistry = { selectHealthyProvider, listProviders };
