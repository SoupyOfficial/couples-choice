import { login } from "@/app/actions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { LoginForm } from "./login-form";

async function getProfiles() {
  return db.select().from(users).limit(2);
}

export default async function LoginPage() {
  const profiles = await getProfiles();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight text-card-foreground">
        Who are you?
      </h1>
      <p className="text-sm text-white/50 -mt-4">Pick your profile to start swiping</p>

      <div className="flex flex-col gap-4 sm:flex-row">
        {profiles.map((profile) => (
          <LoginForm key={profile.id} userId={profile.id}>
            <span className="text-5xl">{profile.emoji}</span>
            <span className="text-lg font-medium text-card-foreground">
              {profile.name}
            </span>
          </LoginForm>
        ))}
      </div>
    </div>
  );
}
