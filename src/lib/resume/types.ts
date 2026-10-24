/**
 * Port of Career Engine's resources/js/types/resume.ts (and the parts of types/knowledge.ts a
 * resume shows): keep them in step. Only the fields the preview reads are declared; the stored
 * snapshot carries more.
 */

export type Claim = {
    ulid: string;
    statement: string;
};

export type Project = {
    ulid: string;
    name: string;
    role: string | null;
    start_date: string | null;
    end_date: string | null;
    claims?: Claim[];
};

export type Employment = {
    ulid: string;
    employer_name: string;
    title: string;
    location: string | null;
    start_date: string;
    end_date: string | null;
    projects?: Project[];
    claims?: Claim[];
};

export type Credential = {
    ulid: string;
    institution: string;
    name: string;
    field_of_study: string | null;
    start_date: string | null;
    end_date: string | null;
};

export type Skill = {
    ulid: string;
    name: string;
};

export type Language = {
    ulid: string;
    language: string;
    proficiency: string;
};

export type ContactLink = {
    ulid: string;
    label: string;
    url: string;
};

/** A bullet always points at a claim; `text` is a rewording for this resume only (null = shared wording). */
export type ResumeBullet = {
    claim: string;
    text: string | null;
};

export type ResumeProjectItem = {
    project: string;
    description: string | null;
    bullets: ResumeBullet[];
};

export type ResumeJob = {
    employment: string;
    display_title: string | null;
    description: string | null;
    bullets: ResumeBullet[];
    projects: ResumeProjectItem[];
};

/** A labelled group of skills, e.g. "Backend: PHP, Laravel". */
export type ResumeSkillGroup = {
    label: string | null;
    items: string[];
};

export type ResumeCredentialItem = {
    credential: string;
};

/** Mirrors App\Domain\Resumes\ResumeDocumentValidator (schema_version 1). */
export type ResumeDocument = {
    schema_version: 1;
    title: string | null;
    summary: string | null;
    experience: ResumeJob[];
    projects: ResumeProjectItem[];
    skills: ResumeSkillGroup[];
    education: ResumeCredentialItem[];
    certifications: ResumeCredentialItem[];
    languages: string[];
    links: string[];
};

export type ResumeLibrary = {
    employments: Employment[];
    standaloneProjects: Project[];
    education: Credential[];
    certifications: Credential[];
    skills: Skill[];
    languages: Language[];
    links: ContactLink[];
};

export type Contact = {
    display_name: string;
    email: string | null;
    phone: string | null;
    location: string | null;
};

/** App\Domain\Resumes\ResumeFacts::snapshot(): stored with each tailored resume version. */
export type ResumeFactsSnapshot = {
    contact: Contact;
    library: ResumeLibrary;
};
