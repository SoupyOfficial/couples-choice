import "dotenv/config";
import { db } from "./index";
import { users } from "./schema";

async function seed() {
  console.log("Seeding database...");

  const existingUsers = await db.select().from(users).all();
  if (existingUsers.length > 0) {
    console.log("Users already exist, skipping seed.");
    return;
  }

  await db.insert(users).values([
    { name: "Partner 1", emoji: "❤️" },
    { name: "Partner 2", emoji: "💙" },
  ]);

  console.log("Seeded 2 users successfully.");
}

seed().catch(console.error);
