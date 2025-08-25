```javascript
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

jest.mock("child_process");
jest.mock("fs");
jest.mock("@google/generative-ai");

describe("generateTests", () => {
  let generateTests;
  let getChangedFilesMock;
  let genAIMock;
  let modelMock;
  let fsMock;
  beforeEach(() => {
    getChangedFilesMock = jest.fn();
    genAIMock = { getGenerativeModel: jest.fn() };
    modelMock = { generateContent: jest.fn() };
    fsMock = {
      existsSync: jest.fn(),
      readFileSync: jest.fn(),
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn(),
      appendFileSync: jest.fn()
    };
    jest.mock("child_process", () => ({ execSync: jest.fn() }));
    jest.mock("fs", () => fsMock);
    jest.mock("@google/generative-ai", () => ({ GoogleGenerativeAI: jest.fn(() => genAIMock) }));
    genAIMock.getGenerativeModel.mockReturnValue(modelMock);
    generateTests = require("./index").generateTests;
  });

  it("should handle no changed files", async () => {
    getChangedFilesMock.mockReturnValue([]);
    console.log = jest.fn();
    await generateTests();
    expect(console.log).toHaveBeenCalledWith("ℹ️  No JS files changed.");
  });

  it("should handle changed files and successful test generation", async () => {
    getChangedFilesMock.mockReturnValue(["test.js"]);
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue("const testFunc = () => {};");
    modelMock.generateContent.mockResolvedValue({
      response: { text: () => "test test" }
    });
    console.log = jest.fn();
    fsMock.existsSync.mockImplementation(filePath => filePath === "tests");
    await generateTests();
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      path.join("tests", "test.test.js"),
      "test test"
    );
    expect(console.log).toHaveBeenCalledWith("⚡ Generating tests for: test.js");
  });


  it("should handle changed files and failed test generation", async () => {
    getChangedFilesMock.mockReturnValue(["test.js"]);
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue("const testFunc = () => {};");
    modelMock.generateContent.mockRejectedValue(new Error("Test generation failed"));
    console.error = jest.fn();
    await generateTests();
    expect(console.error).toHaveBeenCalledWith("⚠️ Failed for test.js:", "Test generation failed");
  });

  it("should handle file system errors", async () => {
    getChangedFilesMock.mockReturnValue(["test.js"]);
    fsMock.existsSync.mockReturnValue(false);
    console.log = jest.fn();
    await generateTests();
    expect(console.log).not.toHaveBeenCalledWith("⚡ Generating tests for: test.js");
  });

  it("should handle empty file content", async () => {
    getChangedFilesMock.mockReturnValue(["test.js"]);
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue("");
    console.log = jest.fn();
    await generateTests();
    expect(console.log).not.toHaveBeenCalledWith("⚡ Generating tests for: test.js");
  });

  it("should append to existing test file", async () => {
    getChangedFilesMock.mockReturnValue(["test.js"]);
    fsMock.existsSync.mockImplementation(filePath => filePath === "tests/test.test.js" || filePath === "tests");
    fsMock.readFileSync.mockReturnValue("const testFunc = () => {};");
    modelMock.generateContent.mockResolvedValue({
      response: { text: () => "test test" }
    });
    fsMock.appendFileSync = jest.fn()
    await generateTests();
    expect(fsMock.appendFileSync).toHaveBeenCalledWith(
      path.join("tests", "test.test.js"),
      "\n\ntest test"
    );
  });

  it("should handle git errors", () => {
    jest.spyOn(execSync, 'toString').mockImplementation(() => { throw new Error("Git error")})
    const consoleErrorSpy = jest.spyOn(console, 'error');
    getChangedFiles()
    expect(consoleErrorSpy).toHaveBeenCalledWith("⚠️ Failed to compute git diff:", "Git error");
  })
});

describe("getChangedFiles", () => {
  it("should return empty array if no env vars are set", () => {
    const result = getChangedFiles()
    expect(result).toEqual([])
  })
})

describe("jestPromptTemplate", () => {
  it("should return a formatted prompt", () => {
    const fileContent = "const testFunc = () => {};";
    const expectedPrompt = `
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
- Validate error handling
- Ensure generated code is executable Jest test code
IMPORTANT:
- Do NOT include explanations, comments, or extra text
- Do NOT include any markdown characters (like \`\`\`javascript)
- Output ONLY pure Jest test code
`;
    expect(jestPromptTemplate(fileContent)).toBe(expectedPrompt);
  });
});
```

```javascript
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");


describe("getChangedFiles", () => {
  let originalEnv;
  beforeEach(() => {
    originalEnv = { ...process.env };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return an empty array if no env vars are set", () => {
    delete process.env.BASE_SHA;
    delete process.env.HEAD_SHA;
    delete process.env.GITHUB_BASE_REF;
    expect(getChangedFiles()).toEqual([]);
  });

  it("should handle baseSha and headSha", () => {
    process.env.BASE_SHA = "base";
    process.env.HEAD_SHA = "head";
    const spyExecSync = jest.spyOn(child_process, 'execSync').mockReturnValue(Buffer.from('file1.js\nfile2.js'));
    expect(getChangedFiles()).toEqual(["file1.js", "file2.js"]);
    spyExecSync.mockRestore();
  });

  it("should handle GITHUB_BASE_REF", () => {
    process.env.GITHUB_BASE_REF = "main";
    const spyExecSync = jest.spyOn(child_process, 'execSync').mockReturnValue(Buffer.from('file3.js'));
    expect(getChangedFiles()).toEqual(["file3.js"]);
    spyExecSync.mockRestore();
  });

  it("should handle default case", () => {
    const spyExecSync = jest.spyOn(child_process, 'execSync').mockReturnValue(Buffer.from('file4.js'));
    expect(getChangedFiles()).toEqual(["file4.js"]);
    spyExecSync.mockRestore();
  });


  it("should handle errors gracefully", () => {
    const spyExecSync = jest.spyOn(child_process, 'execSync').mockImplementation(() => { throw new Error("test error") });
    expect(getChangedFiles()).toEqual([]);
    spyExecSync.mockRestore();
  });
});


describe("generateTests", () => {
  it("should handle no changed files", async () => {
    const spyGetChangedFiles = jest.spyOn(module.exports, 'getChangedFiles').mockReturnValue([]);
    console.log = jest.fn();
    await generateTests();
    expect(console.log).toHaveBeenCalledWith("ℹ️  No JS files changed.");
    spyGetChangedFiles.mockRestore();
  });

  it("should handle file system errors", async () => {
    const spyGetChangedFiles = jest.spyOn(module.exports, 'getChangedFiles').mockReturnValue(["test.js"]);
    const spyReadFileSync = jest.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error("test error") });
    console.error = jest.fn();
    await generateTests();
    expect(console.error).toHaveBeenCalled();
    spyGetChangedFiles.mockRestore();
    spyReadFileSync.mockRestore();

  });

  it("should handle empty file content", async () => {
    const spyGetChangedFiles = jest.spyOn(module.exports, 'getChangedFiles').mockReturnValue(["test.js"]);
    jest.spyOn(fs, 'readFileSync').mockReturnValue("");
    console.log = jest.fn();
    await generateTests();
    expect(console.log).toHaveBeenCalledWith("ℹ️  No JS files changed.");
    spyGetChangedFiles.mockRestore();
  })

  it("should handle model generation errors", async () => {
    const spyGetChangedFiles = jest.spyOn(module.exports, 'getChangedFiles').mockReturnValue(["test.js"]);
    jest.spyOn(fs, 'readFileSync').mockReturnValue("test content");
    const spyGenerateContent = jest.spyOn(GoogleGenerativeAI.prototype, 'generateContent').mockImplementation(() => { throw new Error("test error") });
    console.error = jest.fn();

    await generateTests();
    expect(console.error).toHaveBeenCalled();
    spyGetChangedFiles.mockRestore();
    spyGenerateContent.mockRestore();
  });
});

describe("jestPromptTemplate", () => {
  it("should return a properly formatted prompt", () => {
    const content = "console.log('hello')";
    const expectedPrompt = `
You are an expert JavaScript testing assistant.
Your job is to generate **complete and executable Jest unit tests** for the given code.
=== CODE START ===
${content}
=== CODE END ===
TEST REQUIREMENTS:
- Use the Jest testing framework
- Cover ALL functions, methods, and exported modules in the file
- Organize tests using 'describe' and 'it/test' blocks
- Add meaningful test descriptions
- Include positive (expected behavior) and negative (error/invalid input) cases
- Test edge cases and boundary conditions
- Validate error handling
- Ensure generated code is executable Jest test code
IMPORTANT:
- Do NOT include explanations, comments, or extra text
- Do NOT include any markdown characters (like \`\`\`javascript)
- Output ONLY pure Jest test code
`;
    expect(jestPromptTemplate(content)).toBe(expectedPrompt);
  });
});
```

```javascript
describe("jestPromptTemplate", () => {
  it("should return a properly formatted prompt", () => {
    const fileContent = "const example = 1;";
    const result = jestPromptTemplate(fileContent);
    expect(result).toContain("=== CODE START ===");
    expect(result).toContain(fileContent);
    expect(result).toContain("=== CODE END ===");
    expect(result).toContain("TEST REQUIREMENTS:");
  });

  it("should handle empty file content", () => {
    const result = jestPromptTemplate("");
    expect(result).toContain("=== CODE START ===");
    expect(result).toContain("=== CODE END ===");
    expect(result).toContain("TEST REQUIREMENTS:");
  });
});

describe("getChangedFiles", () => {
  it("should return an empty array if git command fails", () => {
    const originalExecSync = execSync;
    execSync = () => { throw new Error("git error"); };
    const result = getChangedFiles();
    expect(result).toEqual([]);
    execSync = originalExecSync;
  });

  it("should return an array of changed files", () => {
    const originalExecSync = execSync;
    execSync = () => "file1.js\nfile2.js";
    const result = getChangedFiles();
    expect(result).toEqual(["file1.js", "file2.js"]);
    execSync = originalExecSync;

  });
  it("should handle no changed files", () => {
    const originalExecSync = execSync;
    execSync = () => "";
    const result = getChangedFiles();
    expect(result).toEqual([]);
    execSync = originalExecSync;
  });

  it("should handle windows paths", () => {
    const originalExecSync = execSync;
    execSync = () => "file1.js\nfile2.js";
    const result = getChangedFiles();
    expect(result).toEqual(["file1.js","file2.js"]);
    execSync = originalExecSync;
  });
});


describe("generateTests", () => {
  it("should handle no changed files", async () => {
    const originalGetChangedFiles = getChangedFiles;
    getChangedFiles = () => [];
    const originalModelGenerateContent = jest.fn();
    const genAI = {getGenerativeModel: jest.fn().mockReturnValue({generateContent: originalModelGenerateContent})};
    const originalfs = fs;
    fs = {existsSync: jest.fn().mockReturnValue(true), readFileSync: jest.fn().mockReturnValue("test"),writeFileSync: jest.fn(),mkdirSync: jest.fn()};
    global.process = {...process,env: {...process.env,GEMINI_API: "test"}};

    await generateTests();
    expect(console.log).toHaveBeenCalledWith("ℹ️  No JS files changed.");
    fs = originalfs;
    getChangedFiles = originalGetChangedFiles;
  });

  it("should handle file system errors gracefully", async () => {
    const originalGetChangedFiles = getChangedFiles;
    getChangedFiles = () => ["test.js"];
    const originalModelGenerateContent = jest.fn().mockRejectedValue(new Error("API error"));
    const genAI = {getGenerativeModel: jest.fn().mockReturnValue({generateContent: originalModelGenerateContent})};
    const originalfs = fs;
    fs = {existsSync: jest.fn().mockReturnValue(false), readFileSync: jest.fn(),writeFileSync: jest.fn(),mkdirSync: jest.fn()};
    global.process = {...process,env: {...process.env,GEMINI_API: "test"}};


    await generateTests();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed for test.js:"));
    fs = originalfs;
    getChangedFiles = originalGetChangedFiles;
  });

  it("should generate and write test files", async () => {
    const originalGetChangedFiles = getChangedFiles;
    getChangedFiles = () => ["test.js"];
    const originalModelGenerateContent = jest.fn().mockResolvedValue({response:{text: jest.fn().mockReturnValue("test Jest code")}});
    const genAI = {getGenerativeModel: jest.fn().mockReturnValue({generateContent: originalModelGenerateContent})};
    const originalfs = fs;
    fs = {existsSync: jest.fn().mockImplementation((path) => path === "tests"), readFileSync: jest.fn().mockReturnValue("test"),writeFileSync: jest.fn(),mkdirSync: jest.fn()};
    global.process = {...process,env: {...process.env,GEMINI_API: "test"}};

    await generateTests();
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining("tests/test.test.js"), "test Jest code");
    fs = originalfs;
    getChangedFiles = originalGetChangedFiles;
  });
});
```