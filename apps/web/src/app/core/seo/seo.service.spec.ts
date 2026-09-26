import { DOCUMENT } from '@angular/common';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SITE_URL } from '../config/api.config';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  function setup(responseInit: ResponseInit | null = null) {
    TestBed.configureTestingModule({
      providers: [
        { provide: SITE_URL, useValue: 'https://travel.example/' },
        { provide: RESPONSE_INIT, useValue: responseInit }
      ]
    });
    return { seo: TestBed.inject(SeoService), document: TestBed.inject(DOCUMENT) };
  }

  it('sets title, description, canonical and Open Graph tags', () => {
    const { seo, document } = setup();

    seo.setPage({ title: 'Rishikesh guide', description: 'River town.', path: '/destinations/rishikesh', image: '/uploads/a.jpg' });

    expect(document.title).toBe('Rishikesh guide | Travel Platform');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('River town.');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://travel.example/destinations/rishikesh'
    );
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://travel.example/uploads/a.jpg'
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
  });

  it('replaces JSON-LD on each page and escapes "<" so content cannot break out of the script', () => {
    const { seo, document } = setup();

    seo.setPage({ title: 'A', description: 'A', path: '/a', jsonLd: [{ name: '</script><b>x' }] });
    seo.setPage({ title: 'B', description: 'B', path: '/b', jsonLd: [{ name: 'B' }, { name: 'C' }] });

    const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts.length).toBe(2);

    seo.setPage({ title: 'C', description: 'C', path: '/c', jsonLd: [{ name: '</script>' }] });
    const text = document.head.querySelector('script[type="application/ld+json"]')?.textContent ?? '';
    expect(text).not.toContain('</script>');
    expect(JSON.parse(text)).toEqual({ name: '</script>' });
  });

  it('marks missing pages noindex and sets a 404 status during server rendering', () => {
    const responseInit: ResponseInit = {};
    const { seo, document } = setup(responseInit);

    seo.notFound('Destination');

    expect(responseInit.status).toBe(404);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
  });

  it('answers moved content with a 301 and Location during server rendering', () => {
    const responseInit: ResponseInit = {};
    const { seo } = setup(responseInit);

    seo.movedPermanently('/destinations/new-slug');

    expect(responseInit.status).toBe(301);
    expect((responseInit.headers as Record<string, string>)['Location']).toBe('/destinations/new-slug');
  });
});
