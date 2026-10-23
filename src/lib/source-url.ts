/**
 * Port of Career Engine's App\Domain\Applications\SourceUrl. Compares job listing URLs: the same
 * listing opened from an email, a search page or a share link should match, while two listings
 * that differ only in a query parameter (`?jk=…`, `?currentJobId=…`) must not. So only known
 * tracking parameters are dropped; every other parameter is kept.
 */

/** Parameters that only record how the visitor arrived. Prefix matches end in `*`. */
const TRACKING_PARAMETERS = [
    'utm_*', 'gclid', 'gclsrc', 'dclid', 'fbclid', 'msclkid', 'igshid', 'mc_cid', 'mc_eid',
    '_hsenc', '_hsmi', 'trk', 'trkinfo', 'trackingid', 'refid', 'lipi',
];

const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443 };

/**
 * The parts PHP's parse_url() returns for an absolute URL. WHATWG `URL` is not used: it rewrites
 * paths (`/a/../b`), percent-encodes and punycodes, so keys would drift from Laravel's.
 */
const ABSOLUTE_URL = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(?:[^@/?#]*@)?(\[[^\]/?#]*\]|[^:/?#]*)(?::(\d*))?([^?#]*)(?:\?([^#]*))?(?:#[\s\S]*)?$/;

/**
 * A comparison key for the URL, or null when it is not an absolute http(s) URL.
 * Scheme and host are lowercased, a leading `www.`, the default port, the fragment, a trailing
 * slash and tracking parameters are dropped, and the remaining parameters sorted.
 */
export function sourceUrlKey(url: string): string | null {
    const parts = ABSOLUTE_URL.exec(url.trim());

    if (parts === null || parts[2] === '') {
        return null;
    }

    const scheme = parts[1].toLowerCase();

    if (!(scheme in DEFAULT_PORTS)) {
        return null;
    }

    let host = parts[2].toLowerCase();
    host = host.startsWith('www.') ? host.slice(4) : host;
    const port = parts[3] ? Number(parts[3]) : null;
    const portPart = port !== null && port !== DEFAULT_PORTS[scheme] ? `:${port}` : '';
    const path = (parts[4] ?? '').replace(/\/+$/, '');
    const query = canonicalQuery(parts[5] ?? '');

    // http and https serve the same listing; the key ignores the difference.
    return host + portPart + path + (query === '' ? '' : `?${query}`);
}

/** Whether two URLs point at the same listing. */
export function sameSourceUrl(a: string, b: string): boolean {
    const key = sourceUrlKey(a);

    return key !== null && key === sourceUrlKey(b);
}

/** Raw `name=value` pairs, without tracking parameters, sorted. */
function canonicalQuery(query: string): string {
    const pairs: [string, string][] = [];

    for (const pair of query.split('&')) {
        if (pair === '') {
            continue;
        }

        const separator = pair.indexOf('=');
        const name = rawUrlDecode((separator === -1 ? pair : pair.slice(0, separator)).replaceAll('+', ' '));
        const value = separator === -1 ? '' : rawUrlDecode(pair.slice(separator + 1).replaceAll('+', ' '));

        if (!isTracking(name)) {
            pairs.push([name, value]);
        }
    }

    pairs.sort((a, b) => compare(a[0], b[0]) || compare(a[1], b[1]));

    return pairs.map(([name, value]) => `${rawUrlEncode(name)}=${rawUrlEncode(value)}`).join('&');
}

function isTracking(name: string): boolean {
    name = name.toLowerCase();

    return TRACKING_PARAMETERS.some((parameter) =>
        parameter.endsWith('*') ? name.startsWith(parameter.slice(0, -1)) : name === parameter,
    );
}

/** PHP rawurldecode(): decodes every valid `%XX` and leaves malformed sequences alone. */
function rawUrlDecode(text: string): string {
    return text.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
        try {
            return decodeURIComponent(run);
        } catch {
            // Not valid UTF-8 as a whole: decode byte by byte, as PHP would keep the raw bytes.
            return run.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        }
    });
}

/** PHP rawurlencode(): RFC 3986, so `!*'()` are encoded too. */
function rawUrlEncode(text: string): string {
    return encodeURIComponent(text).replace(/[!*'()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** PHP's `<=>` on strings: byte order, not locale order. */
function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}
