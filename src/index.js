import express from "express";
import bodyParser from "body-parser";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
app.use(bodyParser.json());

const nixShells: Record<string, string> = {
  javascript: "nodejs-shell.nix",
  rust: "rust-shell.nix",
  python: "python-shell.nix",
  cpp: "cpp-shell.nix"
};

app.post("/execute", (req, res) => {
  const { language, code } = req.body;

  if (!Object.keys(nixShells).includes(language)) {
    return res.status(400).send("Unsupported language");
  }

  const scriptDir = "/tmp/scripts";
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir);
  }

  const scriptPath = path.join(scriptDir, `script.${language}`);
  fs.writeFileSync(scriptPath, code);

  const nixShell = nixShells[language];
  let command = '';

  switch (language) {
    case 'javascript':
      command = `nix-shell ${nixShell} --run 'node ${scriptPath}'`;
      break;
    case 'rust':
      command = `nix-shell ${nixShell} --run 'cargo script ${scriptPath}'`;
      break;
    case 'python':
      command = `nix-shell ${nixShell} --run 'python ${scriptPath}'`;
      break;
    case 'cpp':
      command = `nix-shell ${nixShell} --run 'g++ ${scriptPath} -o ${scriptDir}/a.out && ${scriptDir}/a.out'`;
      break;
    default:
      return res.status(400).send("Unsupported language");
  }

  exec(command, (error, stdout, stderr) => {
    fs.unlinkSync(scriptPath); // Clean up the script file

    if (error) {
      return res.status(500).send(`Error: ${stderr}`);
    }
    res.send(stdout);
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
