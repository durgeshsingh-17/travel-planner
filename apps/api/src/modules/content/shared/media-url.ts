/**
 * Uploaded files are stored by key; their public URL is built when read, from
 * the current MEDIA_PUBLIC_BASE_URL, so moving the API or adding a CDN never
 * breaks existing images. External media keep the URL they were registered with.
 */
let mediaBaseUrl = '/uploads';

export function configureMediaBaseUrl(baseUrl: string): void {
  mediaBaseUrl = baseUrl.replace(/\/$/, '');
}

export function mediaUrl(media: { url: string; storageKey: string | null }): string {
  return media.storageKey ? `${mediaBaseUrl}/${media.storageKey}` : media.url;
}
