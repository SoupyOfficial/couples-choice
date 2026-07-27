import { execSync } from 'child_process';

async function globalSetup() {
  console.log('Seeding database with test personas...');
  execSync('npx tsx src/db/seed-personas.ts', { 
    cwd: process.cwd(),
    stdio: 'inherit' 
  });
  console.log('Database seeded.');
}

export default globalSetup;
