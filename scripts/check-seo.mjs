import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const canonicalUrl = 'https://elevatorlab.antonsizov.cloud/';
const imageUrl = new URL('og-image.png', canonicalUrl).href;
const imageWidth = 1200;
const imageHeight = 630;

/** Inspect HTML as a crawler receives it, without running application JavaScript. */
export function validateHtml(html, { filename, prerendered }) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const check = (condition, message) => assert(condition, `${filename}: ${message}`);
  const one = (selector) => {
    const matches = document.querySelectorAll(selector);
    check(matches.length === 1, `expected exactly one ${selector}, found ${matches.length}`);
    return matches[0];
  };
  const meta = (name, attribute = 'name') => {
    const element = one(`meta[name="${name}"], meta[property="${name}"]`);
    check(element.getAttribute(attribute) === name, `${name} must use ${attribute}="${name}"`);
    const value = element.getAttribute('content')?.trim();
    check(value, `${name} must have nonempty content`);
    return value;
  };

  try {
    check(
      document.documentElement.lang === 'en-US',
      'HTML language must match the English content',
    );
    const title = one('head title').textContent.trim();
    check(title.length >= 10 && title.length <= 90, 'title must be meaningful and concise');
    const description = meta('description');
    check(description.length >= 50 && description.length <= 200, 'description must be concise');
    const canonical = one('link[rel="canonical"]').getAttribute('href');
    check(canonical === canonicalUrl, 'canonical must be the absolute HTTPS production homepage');
    check(meta('og:url', 'property') === canonical, 'og:url must match the canonical');
    check(meta('og:title', 'property') === title, 'og:title must match the document title');
    check(
      meta('og:description', 'property') === description,
      'OG description must match description',
    );
    check(meta('og:type', 'property') === 'website', 'og:type must be website');
    check(
      meta('og:locale', 'property') === 'en_US',
      'og:locale must use the Open Graph locale format',
    );
    meta('og:site_name', 'property');
    check(meta('og:image', 'property') === imageUrl, 'og:image must use the production PNG URL');
    check(meta('og:image:type', 'property') === 'image/png', 'OG image MIME must be image/png');
    check(Number(meta('og:image:width', 'property')) === imageWidth, 'OG image width must be 1200');
    check(
      Number(meta('og:image:height', 'property')) === imageHeight,
      'OG image height must be 630',
    );
    const imageAlt = meta('og:image:alt', 'property');
    check(imageAlt.length >= 15, 'OG image must have a descriptive alternative');
    check(meta('twitter:card') === 'summary_large_image', 'Twitter card must use the large image');
    check(meta('twitter:title') === title, 'Twitter title must match the document title');
    check(
      meta('twitter:description') === description,
      'Twitter description must match description',
    );
    check(meta('twitter:image') === imageUrl, 'Twitter and Open Graph image URLs must agree');
    check(
      meta('twitter:image:alt') === imageAlt,
      'Twitter and Open Graph image alternatives must agree',
    );
    const robots = meta('robots')
      .toLowerCase()
      .split(',')
      .map((directive) => directive.trim());
    for (const directive of ['index', 'follow', 'max-image-preview:large']) {
      check(robots.includes(directive), `robots must include ${directive}`);
    }
    check(
      !robots.some((value) => ['noindex', 'nofollow', 'none'].includes(value)),
      'page blocks indexing',
    );

    const structuredData = JSON.parse(one('script[type="application/ld+json"]').textContent);
    check(structuredData['@context'] === 'https://schema.org', 'JSON-LD must use schema.org');
    check(structuredData['@type'] === 'WebApplication', 'JSON-LD must describe a WebApplication');
    check(
      typeof structuredData.name === 'string' && structuredData.name.trim(),
      'JSON-LD needs a name',
    );
    check(structuredData.description === description, 'JSON-LD description must match the page');
    check(structuredData.url === canonical, 'JSON-LD URL must match the canonical');
    check(
      (typeof structuredData.image === 'string'
        ? structuredData.image
        : structuredData.image?.url) === imageUrl,
      'JSON-LD image must match the social image',
    );
    check(structuredData.inLanguage === 'en-US', 'JSON-LD language must match the page');
    check(
      structuredData.applicationCategory === 'EducationalApplication',
      'JSON-LD category must describe the lab',
    );
    check(structuredData.isAccessibleForFree === true, 'JSON-LD must identify free access');

    if (prerendered) {
      check(one('h1').textContent.trim().length >= 10, 'prerendered heading is missing');
      check(
        one('app-root').textContent.trim().length > 500,
        'app content must exist without JavaScript',
      );
      check(
        document.querySelectorAll('.call-button').length === 8,
        'prerender must contain eight hall call buttons',
      );
      check(
        document.querySelectorAll('.shaft-track').length === 3,
        'prerender must contain three elevator shafts',
      );
      check(
        document.querySelectorAll('.elevator-car').length === 3,
        'prerender must contain three elevator cars',
      );
    }
    return { title, description, canonical, imageAlt, structuredData };
  } finally {
    dom.window.close();
  }
}

export function validateSeoArtifacts(root = projectRoot) {
  const browserDirectory = path.join(root, 'dist/elevator-demo/browser');
  const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
  const metadata = ['index.html', 'index.csr.html'].map((filename) =>
    validateHtml(readFileSync(path.join(browserDirectory, filename), 'utf8'), {
      filename,
      prerendered: filename === 'index.html',
    }),
  );
  assert.deepEqual(metadata[0], metadata[1], 'Prerendered and CSR metadata must agree');

  const robots = read('public/robots.txt');
  assert.equal(
    readFileSync(path.join(browserDirectory, 'robots.txt'), 'utf8'),
    robots,
    'Built robots.txt is stale',
  );
  assert.match(robots, /^User-agent:\s*\*\s*$/im, 'robots.txt must address all crawlers');
  assert.match(robots, /^Allow:\s*\/\s*$/im, 'robots.txt must allow the homepage');
  assert(!/^Disallow:\s*\/\s*$/im.test(robots), 'robots.txt blocks the homepage');
  const sitemapDirectives = [...robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gim)];
  assert.equal(sitemapDirectives.length, 1, 'robots.txt must name one sitemap');
  assert.equal(
    sitemapDirectives[0][1],
    new URL('sitemap.xml', canonicalUrl).href,
    'Sitemap URL must use the production origin',
  );

  const sitemap = read('public/sitemap.xml');
  assert.equal(
    readFileSync(path.join(browserDirectory, 'sitemap.xml'), 'utf8'),
    sitemap,
    'Built sitemap.xml is stale',
  );
  const sitemapDom = new JSDOM(sitemap, { contentType: 'application/xml' });
  try {
    const document = sitemapDom.window.document;
    assert.equal(document.documentElement.localName, 'urlset', 'Sitemap needs a urlset');
    assert.equal(
      document.documentElement.namespaceURI,
      'http://www.sitemaps.org/schemas/sitemap/0.9',
      'Sitemap namespace is invalid',
    );
    const locations = [...document.querySelectorAll('urlset > url > loc')];
    assert.equal(locations.length, 1, 'Single-page sitemap must list exactly one URL');
    assert.equal(
      locations[0].textContent.trim(),
      canonicalUrl,
      'Sitemap URL must match the canonical',
    );
  } finally {
    sitemapDom.window.close();
  }

  const image = readFileSync(path.join(browserDirectory, 'og-image.png'));
  assert(image.length >= 33, 'OG PNG is truncated');
  assert(image.length <= 2 * 1024 * 1024, 'OG image must stay below 2 MiB');
  assert.deepEqual(
    image.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    'OG image must be a real PNG',
  );
  assert.equal(image.readUInt32BE(8), 13, 'PNG IHDR must have the expected length');
  assert.equal(image.toString('ascii', 12, 16), 'IHDR', 'PNG is missing its IHDR header');
  assert.equal(image.readUInt32BE(16), imageWidth, 'Actual image width must match OG width');
  assert.equal(image.readUInt32BE(20), imageHeight, 'Actual image height must match OG height');
  assert.deepEqual(
    image,
    readFileSync(path.join(root, 'public/og-image.png')),
    'Built OG image differs from the source',
  );
  assert.match(
    read('README.md'),
    /!\[[^\]]+\]\(\.?\/?public\/og-image\.png(?:\s+"[^"]*")?\)/,
    'README must embed public/og-image.png with alternative text',
  );

  return { imageBytes: image.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { imageBytes } = validateSeoArtifacts();
    console.log(
      `SEO checks passed: prerendered HTML, social metadata, JSON-LD, robots, sitemap, and ${imageWidth}×${imageHeight} PNG (${Math.round(imageBytes / 1024)} KiB).`,
    );
  } catch (error) {
    console.error(`SEO check failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
