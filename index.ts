import express, { Request, Response, Express } from "express";
import bodyParser from "body-parser";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";

const app: Express = express();
app.use(bodyParser.json());

const nixShells: Record<string, string> = {
  javascript: "nodejs-shell.nix",
  rust: "rust-shell.nix",
  python: "/path/to/python-shell.nix",
  cpp: "/path/to/cpp-shell.nix",
};

app.post("/execute", async (req: Request, res: Response) => {
  const { language, code } = req.body;

  if (!Object.keys(nixShells).includes(language)) {
    return res.status(400).send("Unsupported language");
  }

  const scriptDir = "/tmp/scripts";
  try {
    await fs.mkdir(scriptDir, { recursive: true });
  } catch (err) {
    return res.status(500).send(`Error creating script directory: ${err}`);
  }

  const scriptPath = path.join(scriptDir, `script.${language}`);
  try {
    await fs.writeFile(scriptPath, code);
  } catch (err) {
    return res.status(500).send(`Error writing script file: ${err}`);
  }

  const nixShell = nixShells[language];
  let command = "";

  switch (language) {
    case "javascript":
      command = `nix-shell ${nixShell} --run 'node ${scriptPath}'`;
      break;
    case "rust":
      command = `nix-shell ${nixShell} --run 'rustc ${scriptPath} -o ${scriptDir}/rust_out && ${scriptDir}/rust_out'`;
      break;
    case "python":
      command = `nix-shell ${nixShell} --run 'python ${scriptPath}'`;
      break;
    case "cpp":
      command = `nix-shell ${nixShell} --run 'g++ ${scriptPath} -o ${scriptDir}/cpp_out && ${scriptDir}/cpp_out'`;
      break;
    default:
      return res.status(400).send("Unsupported language");
  }

  exec(command, { timeout: 10000 }, async (error, stdout, stderr) => {
    try {
      await fs.unlink(scriptPath);
      if (language === "rust") {
        await fs.unlink(path.join(scriptDir, "rust_out")).catch(() => {});
      } else if (language === "cpp") {
        await fs.unlink(path.join(scriptDir, "cpp_out")).catch(() => {});
      }
    } catch (err) {
      console.error(`Error cleaning up files: ${err}`);
    }

    if (error) {
      if (error.signal === "SIGTERM") {
        return res.status(500).send("Script execution timed out");
      }
      return res.status(500).json({ error: error.message, stdout, stderr });
    }
    res.json({ stdout, stderr });
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
