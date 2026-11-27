import { deleteTestUser } from './database';

const createdEmails = new Set<string>();

export function trackUserEmail(email: string): void {
  createdEmails.add(email);
}

export async function cleanupTrackedUsers(): Promise<void> {
  const emails = [...createdEmails];
  createdEmails.clear();
  const results = await Promise.allSettled(emails.map(deleteTestUser));
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failure) throw failure.reason;
}
