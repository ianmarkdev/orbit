import { describe, expect, it } from 'vitest';

import { parseCaptureRequest } from '@/lib/applications/capture-request';

describe('parseCaptureRequest: application extras', () => {
    it('accepts source, subject line, apply requirement, proposal angle and notes', () => {
        const parsed = parseCaptureRequest({
            role_title: 'Engineer',
            source: '  linkedin.com ',
            subject_line: 'Backend – REQ-123',
            apply_requirement: 'video_and_test',
            proposal_angle: 'Lead with payments.\n\nThen scale.',
            notes: 'Referred by Sam.',
        });

        expect(parsed.ok && parsed.value.details).toMatchObject({
            source: 'linkedin.com',
            subjectLine: 'Backend – REQ-123',
            applyRequirement: 'video_and_test',
            proposalAngle: 'Lead with payments.\n\nThen scale.',
            notes: 'Referred by Sam.',
        });
    });

    it('stores missing or blank extras as null', () => {
        const parsed = parseCaptureRequest({ role_title: 'Engineer', source: '   ', notes: '' });

        expect(parsed.ok && parsed.value.details).toMatchObject({ source: null, subjectLine: null, applyRequirement: null, proposalAngle: null, notes: null });
    });

    it('rejects an unknown apply requirement and over-long text', () => {
        const parsed = parseCaptureRequest({ role_title: 'Engineer', apply_requirement: 'essay', subject_line: 'x'.repeat(201), notes: 'x'.repeat(5_001) });

        expect(parsed.ok).toBe(false);
        expect(!parsed.ok && Object.keys(parsed.errors).sort()).toEqual(['apply_requirement', 'notes', 'subject_line']);
        expect(!parsed.ok && parsed.errors.apply_requirement).toEqual(['The selected apply requirement is invalid.']);
    });
});

describe('parseCaptureRequest: important', () => {
    it('marks the application important as Laravel reads a boolean', () => {
        for (const value of [true, 1, '1']) {
            const parsed = parseCaptureRequest({ role_title: 'Engineer', is_important: value });

            expect(parsed.ok && parsed.value.details.isImportant).toBe(true);
        }
    });

    it('is not important when false or left out', () => {
        for (const body of [{ role_title: 'Engineer', is_important: false }, { role_title: 'Engineer', is_important: '0' }, { role_title: 'Engineer' }]) {
            const parsed = parseCaptureRequest(body);

            expect(parsed.ok && parsed.value.details.isImportant).toBe(false);
        }
    });

    it('rejects anything else, as Career Engine does', () => {
        const parsed = parseCaptureRequest({ role_title: 'Engineer', is_important: 'very' });

        expect(parsed.ok).toBe(false);
        expect(!parsed.ok && parsed.errors.is_important).toEqual(['The is important field must be true or false.']);
    });
});
