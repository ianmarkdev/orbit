import { EMPLOYMENT_TYPES, type EmploymentType } from '@/db/schema';
import { characterCount, normalizePlainText } from '@/lib/plain-text';

/**
 * Port of Career Engine's CaptureJobApplicationRequest (and the SaveJobApplicationRequest rules it
 * extends). Career Clipper reads the 422 body field by field, so the pipeline, field names and
 * messages follow Laravel's: TrimStrings and ConvertEmptyStringsToNull, then PlainText
 * normalisation of the text fields, then the rules. Unknown fields are ignored.
 */

export const MAX_JOB_DESCRIPTION_LENGTH = 50_000;

const EXTRACTION_METHODS = ['adapter', 'json-ld', 'meta', 'dom', 'fallback', 'manual'];
const WORKPLACE_TYPES = ['remote', 'hybrid', 'on_site'];
const PAY_PERIODS = ['hour', 'day', 'week', 'month', 'year'];
const CAPTURE_KEYS = ['method', 'site', 'external_id', 'posted_at', 'workplace_type', 'salary', 'captured_at'];
const SALARY_KEYS = ['min', 'max', 'currency', 'period'];

export type ApplicationDetails = {
    companyName: string | null;
    roleTitle: string;
    sourceUrl: string | null;
    location: string | null;
    employmentType: EmploymentType | null;
    salaryText: string | null;
    deadlineOn: string | null;
};

export type CaptureRequest = {
    details: ApplicationDetails;
    jobDescription: string | null;
    /** Identifiers and small structured values for the audit log (never content bodies). */
    captureMetadata: Record<string, unknown>;
    allowDuplicate: boolean;
};

export type ValidationErrors = Record<string, string[]>;

export type ParsedCapture = { ok: true; value: CaptureRequest } | { ok: false; message: string; errors: ValidationErrors };

type Input = Record<string, unknown>;

export function parseCaptureRequest(body: unknown): ParsedCapture {
    const input = prepare(isObject(body) ? body : {});
    const errors: ValidationErrors = {};
    const fail = (field: string, message: string) => (errors[field] ??= []).push(message);
    const label = (field: string) => field.replaceAll('_', ' ');

    const string = (field: string, value: unknown, { required = false, max }: { required?: boolean; max: number }) => {
        if (value === null || value === undefined) {
            if (required) fail(field, `The ${label(field)} field is required.`);
            return;
        }
        if (typeof value !== 'string') return fail(field, `The ${label(field)} field must be a string.`);
        if (characterCount(value) > max) fail(field, `The ${label(field)} field must not be greater than ${max} characters.`);
    };
    const oneOf = (field: string, value: unknown, allowed: readonly string[]) => {
        if (value !== null && value !== undefined && !allowed.includes(value as string)) fail(field, `The selected ${label(field)} is invalid.`);
    };
    const date = (field: string, value: unknown) => {
        if (value !== null && value !== undefined && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) {
            fail(field, `The ${label(field)} field must be a valid date.`);
        }
    };
    const numeric = (field: string, value: unknown): number | null => {
        if (value === null || value === undefined) return null;
        const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
        if (!Number.isFinite(number)) {
            fail(field, `The ${label(field)} field must be a number.`);
            return null;
        }
        if (number < 0) fail(field, `The ${label(field)} field must be at least 0.`);
        if (number > 100_000_000) fail(field, `The ${label(field)} field must not be greater than 100000000.`);
        return number;
    };

    string('company_name', input.company_name, { max: 200 });
    string('role_title', input.role_title, { required: true, max: 200 });
    string('source_url', input.source_url, { max: 2000 });
    if (typeof input.source_url === 'string' && !isWebUrl(input.source_url)) fail('source_url', 'The source url field must be a valid URL.');
    string('location', input.location, { max: 200 });
    oneOf('employment_type', input.employment_type, EMPLOYMENT_TYPES);
    string('salary_text', input.salary_text, { max: 200 });
    if (input.deadline_on !== null && input.deadline_on !== undefined && !isYmd(input.deadline_on)) {
        fail('deadline_on', 'The deadline on field must match the format Y-m-d.');
    }
    string('job_description', input.job_description, { max: MAX_JOB_DESCRIPTION_LENGTH });
    if (input.allow_duplicate !== undefined && input.allow_duplicate !== null && toBoolean(input.allow_duplicate) === null) {
        fail('allow_duplicate', 'The allow duplicate field must be true or false.');
    }

    const capture = input.capture;

    if (capture !== null && capture !== undefined) {
        if (!isObject(capture) || !Object.keys(capture).every((key) => CAPTURE_KEYS.includes(key))) {
            fail('capture', 'The capture field must be an array.');
        } else {
            oneOf('capture.method', capture.method, EXTRACTION_METHODS);
            string('capture.site', capture.site, { max: 255 });
            string('capture.external_id', capture.external_id, { max: 200 });
            date('capture.posted_at', capture.posted_at);
            oneOf('capture.workplace_type', capture.workplace_type, WORKPLACE_TYPES);
            date('capture.captured_at', capture.captured_at);

            const salary = capture.salary;

            if (salary !== null && salary !== undefined) {
                if (!isObject(salary) || !Object.keys(salary).every((key) => SALARY_KEYS.includes(key))) {
                    fail('capture.salary', 'The capture.salary field must be an array.');
                } else {
                    const min = numeric('capture.salary.min', salary.min);
                    const max = numeric('capture.salary.max', salary.max);
                    if (min !== null && max !== null && max < min) fail('capture.salary.max', `The capture.salary.max field must be greater than or equal to ${min}.`);
                    if (salary.currency !== null && salary.currency !== undefined && (typeof salary.currency !== 'string' || !/^[A-Z]{3}$/.test(salary.currency))) {
                        fail('capture.salary.currency', 'The capture.salary.currency field format is invalid.');
                    }
                    oneOf('capture.salary.period', salary.period, PAY_PERIODS);
                }
            }
        }
    }

    const messages = Object.values(errors).flat();

    if (messages.length > 0) {
        const more = messages.length - 1;

        return { ok: false, message: more === 0 ? messages[0] : `${messages[0]} (and ${more} more error${more === 1 ? '' : 's'})`, errors };
    }

    return { ok: true, value: toCaptureRequest(input) };
}

/** TrimStrings + ConvertEmptyStringsToNull on everything, then PlainText on the text fields. */
function prepare(body: Input): Input {
    const input = trimAndNullify(body) as Input;

    for (const [field, multiline] of [['company_name', false], ['role_title', false], ['location', false], ['salary_text', false], ['job_description', true]] as const) {
        if (typeof input[field] === 'string') {
            const clean = normalizePlainText(input[field], multiline);
            input[field] = clean === '' ? null : clean;
        }
    }

    return input;
}

function trimAndNullify(value: unknown): unknown {
    if (typeof value === 'string') {
        const trimmed = value.replace(/^[\s﻿​‎]+|[\s﻿​‎]+$/gu, '');
        return trimmed === '' ? null : trimmed;
    }

    if (Array.isArray(value)) {
        return value.map(trimAndNullify);
    }

    if (isObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trimAndNullify(item)]));
    }

    return value;
}

function toCaptureRequest(input: Input): CaptureRequest {
    const capture = isObject(input.capture) ? input.capture : {};
    const salaryInput = isObject(capture.salary) ? capture.salary : {};
    const text = (value: unknown) => (typeof value === 'string' && (value = normalizePlainText(value)) !== '' ? (value as string) : null);
    const salary = Object.fromEntries(SALARY_KEYS.map((key) => [key, salaryInput[key]]).filter(([, value]) => value !== null && value !== undefined));
    const optional = (value: unknown) => (typeof value === 'string' ? value : null);

    return {
        details: {
            companyName: optional(input.company_name),
            roleTitle: input.role_title as string,
            sourceUrl: typeof input.source_url === 'string' ? input.source_url.trim() : null,
            location: optional(input.location),
            employmentType: optional(input.employment_type) as EmploymentType | null,
            salaryText: optional(input.salary_text),
            deadlineOn: optional(input.deadline_on),
        },
        jobDescription: optional(input.job_description),
        captureMetadata: {
            via: 'browser_extension',
            method: capture.method ?? null,
            site: text(capture.site),
            external_id: text(capture.external_id),
            posted_at: capture.posted_at ?? null,
            workplace_type: capture.workplace_type ?? null,
            salary: Object.keys(salary).length === 0 ? null : salary,
            captured_at: capture.captured_at ?? null,
        },
        allowDuplicate: toBoolean(input.allow_duplicate) ?? false,
    };
}

function isObject(value: unknown): value is Input {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Laravel's `url:http,https`. */
function isWebUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
    } catch {
        return false;
    }
}

/** Laravel's `date_format:Y-m-d`: the exact format and a real calendar date. */
function isYmd(value: unknown): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Laravel's `boolean` rule and `$request->boolean()`. */
function toBoolean(value: unknown): boolean | null {
    if (value === true || value === 1 || value === '1') return true;
    if (value === false || value === 0 || value === '0') return false;
    return null;
}
