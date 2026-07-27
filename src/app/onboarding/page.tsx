import { getCurrentUser } from '@/app/actions';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { extractPreferences } from '@/lib/llm';
import { redirect } from 'next/navigation';

async function savePreferences(formData: FormData) {
  'use server';

  const cookieStore = (await import('next/headers')).cookies();
  const userId = (await cookieStore).get('current-user')?.value;
  if (!userId) redirect('/login');

  const narrative = formData.get('narrative') as string;
  if (!narrative || narrative.trim().length < 10) {
    redirect('/onboarding?error=too-short');
  }

  const prefs = await extractPreferences(Number(userId), narrative.trim());
  if (!prefs) {
    redirect('/onboarding?error=llm-failed');
  }

  await db
    .update(users)
    .set({
      preferenceNarrative: narrative.trim(),
    })
    .where(eq(users.id, Number(userId)));

  redirect('/swipe');
}

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.extractedPrefs) redirect('/swipe');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Tell Us Your Movie Tastes
          </h1>
          <p className="text-sm text-white/50">
            Describe what you both love — we&apos;ll figure out the rest.
          </p>
        </div>

        <form action={savePreferences} className="space-y-6">
          <div className="relative">
            <textarea
              name="narrative"
              rows={6}
              maxLength={1000}
              placeholder="We're into mind-bending sci-fi like Inception and Arrival, but nothing too violent. We also have a soft spot for 90s romantic comedies and Korean thrillers. Absolutely no torture horror or really depressing dramas."
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none text-sm leading-relaxed"
              required
            />
            <div className="absolute bottom-3 right-3 text-xs text-white/30 pointer-events-none">
              Max 1000 characters
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/30 active:scale-[0.98]"
          >
            Analyze My Tastes →
          </button>
        </form>
      </div>
    </main>
  );
}
