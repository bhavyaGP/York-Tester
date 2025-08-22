const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

function jestPromptTemplate(fileContent) {
  return `
You are an expert JavaScript testing assistant.
Your job is to generate **complete and executable Jest unit tests** for the given code.
=== CODE START ===
${fileContent}
=== CODE END ===
TEST REQUIREMENTS:
- Use the Jest testing framework
- Cover ALL functions, methods, and exported modules in the file
- Organize tests using 'describe' and 'it/test' blocks
- Add meaningful test descriptions
- Include positive (expected behavior) and negative (error/invalid input) cases
- Test edge cases and boundary conditions
- Validate error handling (invalid params, wrong operations, etc.)
- Ensure generated code is executable Jest test code
IMPORTANT RESTRICTIONS:
- Do NOT include explanations, comments, or extra text
- Do NOT include any markdown characters like '''javascript or '''python 
- Output ONLY pure Jest test code
`;
}

function getChangedFiles() {
  try {
    const baseSha = process.env.BASE_SHA;
    const headSha = process.env.HEAD_SHA;
    let cmd;

    if (baseSha && headSha) {
      cmd = `git diff --name-only ${baseSha} ${headSha}`;
    } else if (process.env.GITHUB_BASE_REF) {
      cmd = `git diff --name-only origin/${process.env.GITHUB_BASE_REF} HEAD`;
    } else {
      cmd = null;
    }

    if (cmd) {
      const out = execSync(cmd).toString().trim();
      return out ? out.split("\n").map(s => s.trim()).filter(Boolean) : [];
    }

    try {
      execSync('git rev-parse --verify HEAD~1');
      const out = execSync('git diff --name-only HEAD~1 HEAD').toString().trim();
      return out ? out.split('\n').map(s => s.trim()).filter(Boolean) : [];
    } catch (e) {
      const staged = execSync('git diff --name-only --cached').toString().trim();
      const unstaged = execSync('git diff --name-only').toString().trim();
      const untracked = execSync('git ls-files -o --exclude-standard').toString().trim();
      const combined = [staged, unstaged, untracked].filter(Boolean).join('\n');
      return combined ? combined.split('\n').map(s => s.trim()).filter(Boolean) : [];
    }
  } catch (e) {
    console.error("⚠️ Failed to compute git diff:", e.message);
    return [];
  }
}

async function generateTests() {
  const rawChanged = getChangedFiles();
  console.log(`🔍 Found ${rawChanged.length} changed files.`);
  const changedFiles = rawChanged
    .map(f => f.replace(/\\/g, "/"))
    .filter(f => f.endsWith(".js"));
  if (changedFiles.length === 0) {
    console.log("ℹ️  No JS files changed under server/.");
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  for (const file of changedFiles) {
    if (!fs.existsSync(file)) continue;
    const fileContent = fs.readFileSync(file, "utf8");
    if (!fileContent.trim()) continue;

    const prompt = jestPromptTemplate(fileContent);
    console.log(`⚡ Generating tests for: ${file}`);

    try {
      const result = await model.generateContent(prompt);
      const tests = result.response.text();

      const baseName = path.basename(file, ".js");
      const testFileName = path.join("tests", `${baseName}.test.js`);
      const testDir = path.dirname(testFileName);

      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      if (fs.existsSync(testFileName)) {
        console.log(`✏️  Appending new tests → ${testFileName}`);
        fs.appendFileSync(testFileName, `\n\n${tests}`);
      } else {
        console.log(`🥅 Creating → ${testFileName}`);
        fs.writeFileSync(testFileName, tests);
      }
    } catch (err) {
      console.error(`⚠️  Failed to generate/write tests for ${file}:`, err && err.message ? err.message : err);
      continue;
    }
  }
}

generateTests();