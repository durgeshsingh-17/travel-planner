import { DOCUMENT } from '@angular/common';
import { Injectable, RESPONSE_INIT, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { SITE_URL } from '../config/api.config';

export const SITE_NAME = 'Travel Platform';

export interface PageMeta {
  title: string;
  description: string;
  /** Path on this site, e.g. `/destinations/rishikesh`. */
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
  /** Private or thin pages (shared trips, search results) should not be indexed. */
  noindex?: boolean;
  /** One or more schema.org objects rendered as JSON-LD. */
  jsonLd?: object[];
}

/**
 * Sets per-page title, meta description, canonical URL, Open Graph and
 * JSON-LD. Runs during server rendering, so crawlers get it in the HTML.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly siteUrl = inject(SITE_URL).replace(/\/$/, '');
  /** Present only while rendering on the server. */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  setPage(page: PageMeta): void {
    const url = this.absolute(page.path);
    const fullTitle = page.title.includes(SITE_NAME) ? page.title : `${page.title} | ${SITE_NAME}`;
    const description = page.description.slice(0, 170);

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: page.noindex ? 'noindex, follow' : 'index, follow' });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: page.type ?? 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ name: 'twitter:card', content: page.image ? 'summary_large_image' : 'summary' });

    if (page.image) {
      this.meta.updateTag({ property: 'og:image', content: this.absolute(page.image) });
    } else {
      this.meta.removeTag("property='og:image'");
    }

    this.setCanonical(url);
    this.setJsonLd(page.jsonLd ?? []);
  }

  /** Marks a page as not found: noindex in the browser, HTTP 404 during SSR. */
  notFound(what: string): void {
    this.setPage({ title: `${what} not found`, description: `${what} could not be found.`, path: '/', noindex: true });
    this.document.querySelector('link[rel="canonical"]')?.remove();

    if (this.responseInit) {
      this.responseInit.status = 404;
    }
  }

  /** During SSR, answers the request with a permanent redirect to `path`. */
  movedPermanently(path: string): void {
    if (this.responseInit) {
      this.responseInit.status = 301;
      this.responseInit.headers = { ...(this.responseInit.headers as Record<string, string>), Location: path };
    }
  }

  absolute(pathOrUrl: string): string {
    return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${this.siteUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  }

  breadcrumbs(items: Array<{ name: string; path: string }>): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: this.absolute(item.path)
      }))
    };
  }

  faqPage(faqs: Array<{ question: string; answer: string }>): object | null {
    return faqs.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer }
          }))
        }
      : null;
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }

    link.setAttribute('href', url);
  }

  private setJsonLd(objects: object[]): void {
    this.document.head.querySelectorAll('script[data-seo="json-ld"]').forEach((node) => node.remove());

    for (const object of objects) {
      const script = this.document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-seo', 'json-ld');
      // Escape "<" so content can never close the script tag.
      script.textContent = JSON.stringify(object).replace(/</g, '\\u003c');
      this.document.head.appendChild(script);
    }
  }
}
