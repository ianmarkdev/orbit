import 'server-only';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * On App Hosting the Admin SDK finds its project and credentials by itself. Locally, set
 * GOOGLE_APPLICATION_CREDENTIALS to a service account key of the same Firebase project.
 */
export function adminAuth() {
    return getAuth(getApps()[0] ?? initializeApp());
}
