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