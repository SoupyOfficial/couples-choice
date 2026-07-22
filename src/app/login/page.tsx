import { login } from "@/app/actions";
import { db } from "@/db";
import { users } from "@/db/schema";


async function getProfiles() {
  return db.select().from(users).limit(2);
}

export default async function LoginPage() {
  const profiles = await getProfiles();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight text-card-foreground">
        Who are you?
      </h1>
      <p className="text-sm text-white/50 -mt-4">Pick your profile to start swiping</p>

      <div className="flex flex-col gap-4 sm:flex-row">
        {profiles.map((profile) => (
          <form key={profile.id} action={login.bind(null, profile.id)}>
            <button
              type="submit"
              className="group flex w-48 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-card/60 px-6 py-8 transition-all duration-200 hover:scale-105 hover:border-brand/50 hover:bg-card/90 hover:shadow-lg hover:shadow-brand/20"
            >
              <span className="text-5xl">{profile.emoji}</span>
              <span className="text-lg font-medium text-card-foreground">
                {profile.name}
              </span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
