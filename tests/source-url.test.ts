import { describe, expect, it } from 'vitest';

import { sameSourceUrl, sourceUrlKey } from '@/lib/source-url';

// Ported from career-engine/tests/Unit/Domain/Applications/SourceUrlTest.php: keep them in step.

describe('sourceUrlKey', () => {
    it.each([
        ['plain', 'https://jobs.example.com/listing/123?id=9'],
        ['www and uppercase host', 'https://WWW.Jobs.Example.com/listing/123?id=9'],
        ['trailing slash and fragment', 'https://jobs.example.com/listing/123/?id=9#apply'],
        ['default port', 'https://jobs.example.com:443/listing/123?id=9'],
        ['http', 'http://jobs.example.com/listing/123?id=9'],
        ['tracking parameters', 'https://jobs.example.com/listing/123?utm_source=x&id=9&gclid=abc&trackingId=q&refId=r'],
        ['surrounding whitespace', '  https://jobs.example.com/listing/123?id=9\n'],
    ])('gives the same listing reached in different ways one key (%s)', (_, variant) => {
        expect(sourceUrlKey(variant)).toBe('jobs.example.com/listing/123?id=9');
    });

    it('keeps meaningful query parameters and ignores their order', () => {
        expect(sameSourceUrl('https://x.test/view?jk=1&from=a', 'https://x.test/view?from=a&jk=1')).toBe(true);
        expect(sameSourceUrl('https://x.test/view?jk=1', 'https://x.test/view?jk=2')).toBe(false);
        expect(sourceUrlKey('https://x.test/view?a.b=1')).toBe('x.test/view?a.b=1');
    });

    it('treats path case and non-default ports as significant', () => {
        expect(sameSourceUrl('https://x.test/Job/A', 'https://x.test/job/a')).toBe(false);
        expect(sourceUrlKey('https://x.test:8443/job')).toBe('x.test:8443/job');
    });

    it.each(['', 'not a url', '/relative/path', 'javascript:alert(1)', 'mailto:jobs@example.com', 'ftp://x.test/a', 'http://'])(
        'gives malformed or non-web URLs no key (%j)',
        (url) => {
            expect(sourceUrlKey(url)).toBeNull();
            expect(sameSourceUrl(url, url)).toBe(false);
        },
    );
});
