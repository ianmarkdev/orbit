import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { findApplication, findApplicationPack } from '@/lib/applications/service';
import { requireActor } from '@/lib/auth/session';
import { indexLibrary } from '@/lib/resume/document';

import { PrintButton } from '../copy-button';
import { ResumePreview } from '../resume-preview';

export const metadata: Metadata = { title: 'Resume · Career VA' };

/** The approved tailored resume on its own, for the browser's Save as PDF. */
export default async function ResumePrintPage({ params }: PageProps<'/applications/[ulid]/resume'>) {
    const actor = await requireActor();
    const { ulid } = await params;
    const application = await findApplication(actor, ulid);

    if (application === null) {
        notFound();
    }

    const { resume } = await findApplicationPack(actor, application.id);

    if (resume === null) {
        notFound();
    }

    const { contact, library } = resume.factsSnapshot;

    return (
        <div className="mx-auto max-w-[210mm] space-y-6 print:max-w-none">
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <Link href={`/applications/${application.ulid}`} className="text-sm text-muted hover:text-foreground">
                    ← {application.roleTitle}
                </Link>
                <PrintButton fileName={`${contact.display_name} – ${application.roleTitle} resume`} />
            </div>
            <p className="text-sm text-muted print:hidden">In the print dialog, choose “Save as PDF” as the destination and turn off headers and footers.</p>
            <ResumePreview document={resume.document} contact={contact} index={indexLibrary(library)} />
        </div>
    );
}
