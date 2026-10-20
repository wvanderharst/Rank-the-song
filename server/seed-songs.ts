import { db } from "./db";
import { songs } from "@shared/schema";



async function seedDatabase() {
  console.log("Seeding database with Top 2000 songs...");
  
  try {
    await db.delete(songs);
    
    for (const song of top2000Songs2024) {
      await db.insert(songs).values(song);
    }
    
    console.log(`Successfully seeded ${top2000Songs2024.length} songs!`);
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seedDatabase()
  .then(() => {
    console.log("Database seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to seed database:", error);
    process.exit(1);
  });
