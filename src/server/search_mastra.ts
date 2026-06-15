import fs from "fs";
import path from "path";

function searchDir(dir: string, query: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath, query);
    } else if (file.endsWith(".js") || file.endsWith(".ts")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.includes(query) && file.includes("agent")) {
        console.log(`Found in: ${fullPath}`);
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          if (line.includes(query) && (line.includes("async generate") || line.includes("generate("))) {
            console.log(`  Line ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchDir("./node_modules/@mastra/core", "generate");
