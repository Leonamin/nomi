import { resolveMediaDeliveryUrl } from './assetDeliveryUrl'

export function buildVideoPlaybackUrl(rawVideoUrl: string): string {
  return resolveMediaDeliveryUrl(rawVideoUrl.trim())
}
