import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const { count } = await prisma.lead.deleteMany();
  console.log(`Deleted ${count} lead${count === 1 ? "" : "s"} (cascaded to their qualifications and routing logs).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
