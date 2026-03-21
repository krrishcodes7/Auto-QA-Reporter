import type { BrokenLink } from './types.js';

function classifyStatus(statusCode: number, error?: string): string {
  if (error) return 'Timeout/Error';
  if (statusCode >= 200 && statusCode < 300) return 'OK';
  if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) return 'Redirect';
  if (statusCode === 404) return 'Not Found';
  if (statusCode >= 400 && statusCode < 500) return 'Client Error';
  if (statusCode >= 500) return 'Server Error';
  return 'Unknown';
}

export async function checkLinks(
  links: Array<{ sourcePage: string; linkUrl: string }>
): Promise<BrokenLink[]> {
  const brokenLinks: BrokenLink[] = [];
  const checked = new Set<string>();
  const linksByUrl = new Map<string, { sourcePage: string; linkUrl: string }>();

  for (const link of links) {
    if (!checked.has(link.linkUrl)) {
      checked.add(link.linkUrl);
      linksByUrl.set(link.linkUrl, link);
    }
  }

  const uniqueLinks = Array.from(linksByUrl.values());
  const batchSize = 10;

  for (let i = 0; i < uniqueLinks.length; i += batchSize) {
    const batch = uniqueLinks.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async ({ sourcePage, linkUrl }) => {
        let statusCode = 0;
        let error: string | undefined;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(linkUrl, {
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AutonomousQAInspector/1.0)' },
            redirect: 'follow',
          }).catch(async () => {
            return fetch(linkUrl, {
              method: 'GET',
              signal: controller.signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AutonomousQAInspector/1.0)' },
              redirect: 'follow',
            });
          });

          clearTimeout(timeoutId);
          statusCode = res.status;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('abort')) {
            error = 'Timeout after 8 seconds';
          } else {
            error = msg.substring(0, 200);
          }
          statusCode = 0;
        }

        const statusType = classifyStatus(statusCode, error);

        if (statusCode === 0 || statusCode === 404 || statusCode >= 400) {
          brokenLinks.push({
            sourcePage,
            linkUrl,
            statusCode,
            statusType,
            error,
          });
        }
      })
    );
  }

  return brokenLinks;
}
