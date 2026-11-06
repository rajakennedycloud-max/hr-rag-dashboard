import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "hr@2024";

async function main() {
  const hashed = await bcrypt.hash(PASSWORD, 10);

  const users = [
    { email: "admin@hrtest.com", name: "Admin", role: "ADMIN", sector: null },
    // Business heads (read-only views)
    { email: "premkumar@hrtest.com", name: "Premkumar", role: "BUSINESS_HEAD", sector: "Technology" },
    { email: "inigo.paul@hrtest.com", name: "Inigo Paul", role: "BUSINESS_HEAD", sector: "BFSI" },
    // Recruiters from the Candidate Report workbook
    { email: "pawan.sharma@hrtest.com", name: "Pawan SHARMA", role: "TA_SPECIALIST", sector: null },
    { email: "shashwat.shashwat@hrtest.com", name: "Shashwat SHASHWAT", role: "TA_SPECIALIST", sector: null },
    { email: "hina.varshney@hrtest.com", name: "Hina VARSHNEY", role: "TA_SPECIALIST", sector: null },
    { email: "utkarsh.verma@hrtest.com", name: "Utkarsh VERMA", role: "TA_SPECIALIST", sector: null },
    { email: "gokulakrishnan.b@hrtest.com", name: "Gokulakrishnan B", role: "TA_SPECIALIST", sector: null },
    { email: "manisa.das@hrtest.com", name: "Manisa DAS", role: "TA_SPECIALIST", sector: null },
    { email: "anand.yadav@hrtest.com", name: "Anand YADAV", role: "TA_SPECIALIST", sector: null },
    { email: "gauri.singh@hrtest.com", name: "Gauri SINGH", role: "TA_SPECIALIST", sector: null },
    { email: "gulshan.bhogal@hrtest.com", name: "Gulshan BHOGAL", role: "TA_SPECIALIST", sector: null },
    { email: "karthick.n@hrtest.com", name: "Karthick N", role: "TA_SPECIALIST", sector: null },
    { email: "vikrant.khandelwal@hrtest.com", name: "Vikrant KHANDELWAL", role: "TA_SPECIALIST", sector: null },
    { email: "punith.a@hrtest.com", name: "Punith KUMAR A", role: "TA_SPECIALIST", sector: null },
    { email: "shazia.chowdhary@hrtest.com", name: "Shazia CHOWDHARY", role: "TA_SPECIALIST", sector: null },
    { email: "ananthi.v@hrtest.com", name: "Ananthi V", role: "TA_SPECIALIST", sector: null },
    { email: "gurpreet.singh@hrtest.com", name: "Gurpreet SINGH", role: "TA_SPECIALIST", sector: null },
    { email: "anuj.chaturvedi@hrtest.com", name: "Anuj CHATURVEDI", role: "TA_SPECIALIST", sector: null },
    { email: "ritik.kumar@hrtest.com", name: "Ritik KUMAR", role: "TA_SPECIALIST", sector: null },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, sector: u.sector },
      create: { ...u, password: hashed },
    });
    console.log(`✓ ${u.email} (${u.role})`);
  }

  console.log(`\nSeed complete. All accounts use password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
