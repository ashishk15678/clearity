import "dotenv/config";
import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
  orm: {
    schema: "./prisma/schema.prisma",
    db: {
      connection: process.env.DATABASE_URL,
    },
  },
});
