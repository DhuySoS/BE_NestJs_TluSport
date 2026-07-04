import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const roles = ['ROLE_ADMIN', 'ROLE_USER', 'ROLE_STAFF'];

async function main() {
  await client.connect();

  for (const name of roles) {
    await client.query(
      `INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [name],
    );
    console.log(`✔ Role "${name}" seeded`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
