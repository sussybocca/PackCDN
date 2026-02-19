// hsx-runtime-full.js — HSX v0.85+ MODULE SYSTEM
// © 2026 William Isaiah Jones + HSXEngine integration
// Expanded with module installation (.module.hsx) and full module command language

export class HSXRuntime {
  constructor() {
    // ----- ORIGINAL FIELDS (unchanged) -----
    this.components = {};
    this.context = {};
    this.blocks = {};
    this.data = {};
    this.modules = {};
    this.attachments = {};
    this.metaTags = {};
    this.emotions = {};
    this.pyodide = null;
    this.sandboxed = true;

    this.emotionActive = false;
    this.dataExportActive = false;
    this.metaActive = false;

    // HSXEngine fields
    this.botsDB = {};
    this.customDatabaseBlocks = {};
    this.storages = {};
    this.physicStorage = {};
    this.customStorages = {};
    this.customCodeLines = {};

    // NEW CUSTOM SYSTEM FIELDS
    this.customLanguages = {};
    this.fxEnabled = false;
    this.gameConfig = { pixels: [], fps: 60, reload: false, spawnCorner: false, fx: false };
    this.jayTagsEnabled = false;

    // ----- NEW FIELDS FOR ENHANCED LANGUAGE -----
    this.state = {};                // runtime variables
    this.elements = {};             // custom reusable elements
    this.importCache = new Set();   // prevent duplicate imports
    this.debug = false;             // verbose logging
    this.currentFilePath = null;    // for error context
    this.lastError = null;          // stores last error for debugging

    // ----- NEW MODULE SYSTEM -----
    this.moduleRegistry = {};        // installed modules (by path)
    this.moduleExports = {};          // exports from installed modules (by module name)
  }

  // ---------------- ENHANCED ERROR HANDLING ----------------
  _error(message, lineNumber, lineText, fatal = false) {
    const file = this.currentFilePath || '<unknown>';
    const snippet = lineText ? `\n  at line ${lineNumber}: ${lineText}` : '';
    const fullMsg = `❌ HSX Error [${file}:${lineNumber}]${snippet}\n  ${message}`;
    console.error(fullMsg);
    this.lastError = { message, lineNumber, lineText, file };
    if (fatal) throw new Error(fullMsg);
    return fullMsg;
  }

  _warn(message, lineNumber, lineText) {
    if (!this.debug) return;
    const file = this.currentFilePath || '<unknown>';
    const snippet = lineText ? `\n  at line ${lineNumber}: ${lineText}` : '';
    console.warn(`⚠️ HSX Warning [${file}:${lineNumber}]${snippet}\n  ${message}`);
  }

  // ---------------- ORIGINAL HSXEngine Methods (unchanged) ----------------
  embedPhysic(storageName) {
    this.physicStorage[storageName] = this.storages[storageName];
    Object.defineProperty(this, `_physic_${storageName}`, {
      value: this.storages[storageName],
      writable: true,
      enumerable: false
    });
  }

  createCustomStorage(name) {
    this.customStorages[name] ??= {};
    return this.customStorages[name];
  }

  runHSXEngineLine(line, lines, index) {
    // Bots database
    if (line === "bots:") {
      this.botsDB.records ??= [];
      index++;
      while (lines[index]?.trim().startsWith(";:")) {
        const raw = lines[index].replace(";:", "").trim();
        const [name, bot, meta] = raw.split(",").map(v => v.trim());
        this.botsDB.records.push({ name, bot, meta, formats: {} });
        index++;
      }
      return index - 1;
    }

    // HSX storage blocks
    if (line === ":Hsx:") {
      index++;
      let next = lines[index]?.trim();
      if (!next) return index;

      if (next.startsWith("$")) {
        const storageName = next.replace("$", "").trim();
        this.storages[storageName] ??= {};
        index++;
        while (lines[index]?.includes("=")) {
          let [k, v] = lines[index].split("=").map(x => x.trim());
          this.storages[storageName][k] = v.replace(/"/g, "");
          index++;
        }
        this.embedPhysic(storageName);
      } else if (next.startsWith("create storage")) {
        const storageName = next.split(" ").slice(2).join(" ").trim();
        this.createCustomStorage(storageName);
        index++;
        while (lines[index]?.includes("=")) {
          let [k, v] = lines[index].split("=").map(x => x.trim());
          this.customStorages[storageName][k] = v.replace(/"/g, "");
          index++;
        }
      } else if (next.endsWith(":") && !next.startsWith("$")) {
        const dbName = next.replace(":", "");
        this.customDatabaseBlocks[dbName] ??= [];
        index++;
        while (lines[index]?.trim().startsWith(";:")) {
          this.customDatabaseBlocks[dbName].push(lines[index].replace(";:", "").trim());
          index++;
        }
      }
      return index - 1;
    }

    // CCCL Custom code lines
    if (line.startsWith("CCCL")) {
      const name = line.split(" ")[1];
      index++;
      let block = [];
      while (lines[index]?.trim() !== "}") {
        block.push(lines[index]);
        index++;
      }
      this.customCodeLines[name] = block.join("\n");
      return index;
    }

    // Execute custom code lines
    if (this.customCodeLines[line]) {
      const block = this.customCodeLines[line];
      const subLines = block.split("\n");
      let subIndex = 0;
      while (subIndex < subLines.length) {
        subIndex = this.runHSXEngineLine(subLines[subIndex].trim(), subLines, subIndex) + 1;
      }
    }

    // -------- NEW/ENHANCED HSX CUSTOM LANGUAGE / FX / GAME SYSTEM --------
    if (line.startsWith(":hsx:")) {
      const cmd = line.replace(":hsx:", "").trim();

      // CREATE NEW CODING LANGUAGE
      if (cmd.startsWith("create new coding lango")) {
        const name = cmd.split("custom lango")[1]?.trim();
        if (name) this.customLanguages[name] = {};
        console.log("🧬 New language created:", name);
      }

      // FX ENABLE
      if (cmd.includes("fx attach fx")) {
        this.fxEnabled = true;
        document.body.style.filter = "hue-rotate(15deg) saturate(1.4)";
        console.log("✨ FX enabled");
      }

      // ALLOW CUSTOM LANGUAGE FILES
      if (cmd.includes("allow new coding language files")) {
        console.log("📄 New coding language files allowed");
      }

      // GAME PIXELS
      if (cmd.includes("game pixel")) {
        const colors = cmd.match(/red|blue|orange/g) || [];
        this.gameConfig.pixels = colors;
      }

      // NEW DATA
      if (cmd.includes("new data")) {
        const parts = cmd.split("eq");
        this.data[parts[0].trim()] = parts[1]?.trim();
      }

      // NEW FUNCTION
      if (cmd.includes("new function")) {
        const name = cmd.split(":")[1]?.trim();
        if (name) this.context[name] = () => console.log(`🧠 Custom function ${name} called`);
      }

      // CREATE NEW BLOCK MODE
      if (cmd.includes("create new block mode")) {
        const name = cmd.split("call it")[1]?.trim();
        this.blocks[name] = {};
        console.log("🧱 New block mode:", name);
      }

      // GAME SETTINGS
      if (cmd.includes("reload")) this.gameConfig.reload = true;
      if (cmd.includes("spawn")) this.gameConfig.spawnCorner = true;
      if (cmd.includes("fps")) this.gameConfig.fps = parseInt(cmd.match(/\d+/)?.[0] || 60);
      if (cmd.includes("framerates")) this.gameConfig.fps = parseInt(cmd.match(/\d+/)?.[0] || 60);
      if (cmd.includes("fx")) this.gameConfig.fx = true;

      // JAY TAGS
      if (cmd.includes("allow new custom tags jay")) {
        this.jayTagsEnabled = true;
        document.body.innerHTML = "";
        console.log("🏷️ JayTags enabled");
      }

      // --- NEW :hsx: SUBCOMMANDS (enhancements) ---
      if (cmd.startsWith("set debug")) {
        this.debug = cmd.includes("on") || cmd.includes("true");
        console.log(`🐛 Debug mode: ${this.debug}`);
      }

      if (cmd.startsWith("set fps")) {
        const fps = parseInt(cmd.match(/\d+/)?.[0] || 60);
        this.gameConfig.fps = fps;
        console.log(`⏱️ FPS set to ${fps}`);
      }

      if (cmd.startsWith("create pixel")) {
        // :hsx: create pixel red 10 20
        const parts = cmd.split(" ");
        const color = parts[2] || "red";
        const x = parseInt(parts[3]) || 0;
        const y = parseInt(parts[4]) || 0;
        if (!this.gameConfig.pixels) this.gameConfig.pixels = [];
        this.gameConfig.pixels.push({ color, x, y });
        console.log(`🎨 Pixel added at (${x},${y}) color ${color}`);
      }

      return index;
    }

    return index;
  }

  runHSXEngine(code) {
    const lines = code.split("\n").map(l => l.trim());
    for (let i = 0; i < lines.length; i++) {
      i = this.runHSXEngineLine(lines[i], lines, i);
    }

    if (this.gameConfig.pixels.length) this.startPixelGame();
  }

  // ---------------- ORIGINAL HSXRuntime Methods (with enhanced error handling) ----------------
  async initPyodide() {
    if (!this.pyodide) {
      console.log("🐍 Initializing Pyodide...");
      try {
        const { loadPyodide } = await import("./pyodide/pyodide.mjs");
        this.pyodide = await loadPyodide({ indexURL: "./pyodide/" });
      } catch (e) {
        this._warn("Pyodide not available; Python blocks will be skipped.");
      }
    }
  }

  async loadFiles(filePaths) {
    if (!Array.isArray(filePaths)) filePaths = [filePaths];
    for (const path of filePaths) await this.load(path);
  }

  async load(filePath) {
    this.currentFilePath = filePath;
    console.log(`🌀 Loading HSX file: ${filePath}`);
    try {
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const code = await response.text();
      await this.execute(code);
      this.runHSXEngine(code);
    } catch (e) {
      this._error(`Failed to load HSX file: ${e.message}`, 0, '', true);
    } finally {
      this.currentFilePath = null;
    }
  }

  async execute(code) {
    const lines = code.split("\n").map(l => l.trimEnd());
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      if (!line) continue;

      try {
        // First, let runHSXEngineLine handle its special syntaxes
        i = this.runHSXEngineLine(line, lines, i);

        // Then handle other HSX commands (original + new)
        if (line.startsWith("hsx attach image")) { this._attachMedia("img", this._extractQuotes(line)); continue; }
        if (line.startsWith("hsx attach video")) { this._attachMedia("video", this._extractQuotes(line)); continue; }
        if (line.startsWith("hsx attach audio")) { this._attachMedia("audio", this._extractQuotes(line)); continue; }

        // ----- ORIGINAL COMPONENT DEFINITION -----
        if (line.startsWith("hsx define component")) {
          const name = line.replace("hsx define component", "").trim();
          let body = "";
          i++;
          while (i < lines.length && !lines[i].startsWith("hsx end")) { body += lines[i] + "\n"; i++; }
          this.components[name] = body;
          console.log(`🧩 Component defined: ${name}`);
          continue;
        }
        if (line.startsWith("hsx render")) {
          this._renderComponent(line.replace("hsx render", "").trim());
          continue;
        }

        // ----- ORIGINAL CODE BLOCKS -----
        if (line.startsWith("{js") || line.startsWith("{py") || line.startsWith("{hsx")) {
          let block = "";
          const type = line.slice(1, 3);
          i++;
          while (i < lines.length && !lines[i].match(/^}\s*$/)) { block += lines[i] + "\n"; i++; }
          if (type === "js") await this._runJS(block, true);
          else if (type === "py") await this._runPy(block);
          else if (type === "hsx") await this._runHSXBlock(block);
          continue;
        }

        if (line.startsWith("hsx security")) {
          this.sandboxed = line.replace("hsx security", "").trim() !== "off";
          console.log(`🔒 HSX security mode: ${this.sandboxed ? "ON" : "OFF"}`);
          continue;
        }

        if (line.startsWith("hsx modules:")) {
          await this._handleModules(line.replace("hsx modules:", "").trim());
          continue;
        }

        if (line.startsWith("hsx:") || line.startsWith("(hsx)")) {
          await this._handleNewHSXCommands(line);
          continue;
        }

        if (line.startsWith("(funny)")) {
          await this._handleFunnyBlock(line, lines, i);
          continue;
        }

        // ----- NEW LANGUAGE FEATURES (backward-compatible) -----
        if (line.startsWith("hsx let")) {
          this._handleLet(line, i);
          continue;
        }

        if (line.startsWith("hsx set")) {
          this._handleSet(line, i);
          continue;
        }

        if (line.startsWith("hsx if")) {
          i = this._handleIf(lines, i);
          continue;
        }

        if (line.startsWith("hsx for")) {
          i = this._handleFor(lines, i);
          continue;
        }

        if (line.startsWith("hsx import")) {
          await this._handleImport(line, i);
          continue;
        }

        if (line.startsWith("hsx element")) {
          i = this._handleElement(lines, i);
          continue;
        }

        if (line.startsWith("hsx debug")) {
          this.debug = line.includes("on");
          console.log(`🐛 Debug mode: ${this.debug}`);
          continue;
        }

        // If nothing matched, just log as meta (original behavior)
        console.log(`ℹ️ HSX meta line: ${line}`);
      } catch (e) {
        this._error(e.message, i + 1, rawLine, false);
      }
    }
    console.log("✅ HSX execution complete!");
  }

  // --------- NEW HELPER METHODS FOR ENHANCED LANGUAGE ---------
  _handleLet(line, lineNum) {
    const parts = line.replace("hsx let", "").trim().split("=");
    if (parts.length < 2) {
      this._error("Invalid 'hsx let' syntax. Use: hsx let variable = value", lineNum, line);
      return;
    }
    const varName = parts[0].trim();
    let value = parts.slice(1).join("=").trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (!isNaN(value)) value = Number(value);
    this.state[varName] = value;
    if (this.debug) console.log(`📦 Variable set: ${varName} =`, value);
  }

  _handleSet(line, lineNum) {
    const parts = line.replace("hsx set", "").trim().split("=");
    if (parts.length < 2) {
      this._error("Invalid 'hsx set' syntax. Use: hsx set variable = value", lineNum, line);
      return;
    }
    const varName = parts[0].trim();
    if (!(varName in this.state)) {
      this._warn(`Variable '${varName}' not defined; creating it.`, lineNum, line);
    }
    let value = parts.slice(1).join("=").trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (!isNaN(value)) value = Number(value);
    this.state[varName] = value;
    if (this.debug) console.log(`📦 Variable updated: ${varName} =`, value);
  }

  _handleIf(lines, startIndex) {
    let i = startIndex;
    const line = lines[i].trim();
    const conditionExpr = line.replace("hsx if", "").trim();
    let condition = false;
    try {
      condition = this._evaluateExpression(conditionExpr);
    } catch (e) {
      this._error(`Condition evaluation failed: ${e.message}`, i+1, line);
      while (i < lines.length && !lines[i].trim().startsWith("hsx endif")) i++;
      return i;
    }

    let thenBlock = [];
    i++;
    while (i < lines.length && !lines[i].trim().startsWith("hsx else") && !lines[i].trim().startsWith("hsx endif")) {
      thenBlock.push(lines[i]);
      i++;
    }

    let elseBlock = [];
    if (lines[i]?.trim().startsWith("hsx else")) {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("hsx endif")) {
        elseBlock.push(lines[i]);
        i++;
      }
    }

    const blockToExec = condition ? thenBlock : elseBlock;
    for (let line of blockToExec) {
      this._interpretLine(line, i);
    }

    if (lines[i]?.trim().startsWith("hsx endif")) i++;
    return i - 1;
  }

  _handleFor(lines, startIndex) {
    let i = startIndex;
    const line = lines[i].trim();
    const parts = line.replace("hsx for", "").trim().split(/\s+in\s+/);
    if (parts.length !== 2) {
      this._error("Invalid 'hsx for' syntax. Use: hsx for var in list", i+1, line);
      while (i < lines.length && !lines[i].trim().startsWith("hsx endfor")) i++;
      return i;
    }
    const varName = parts[0].trim();
    const listExpr = parts[1].trim();
    let list = this._evaluateExpression(listExpr);
    if (!Array.isArray(list)) {
      this._warn(`Expression '${listExpr}' did not evaluate to an array; using empty list.`, i+1, line);
      list = [];
    }

    i++;
    const bodyLines = [];
    while (i < lines.length && !lines[i].trim().startsWith("hsx endfor")) {
      bodyLines.push(lines[i]);
      i++;
    }
    if (lines[i]?.trim().startsWith("hsx endfor")) i++;

    for (let item of list) {
      const previous = this.state[varName];
      this.state[varName] = item;
      for (let line of bodyLines) {
        this._interpretLine(line, i);
      }
      if (previous !== undefined) this.state[varName] = previous;
      else delete this.state[varName];
    }

    return i - 1;
  }

  async _handleImport(line, lineNum) {
    const match = line.match(/"([^"]+)"/);
    if (!match) {
      this._error("Invalid 'hsx import' syntax. Use: hsx import \"file.hsx\"", lineNum, line);
      return;
    }
    const path = match[1];

    // Check if it's a module installation
    if (path.endsWith('.module.hsx')) {
      await this._installModule(path);
      return;
    }

    // Regular HSX file import
    if (this.importCache.has(path)) {
      if (this.debug) console.log(`⏭️ Already imported: ${path}`);
      return;
    }
    this.importCache.add(path);
    await this.load(path);
  }

  // --------- NEW MODULE INSTALLATION SYSTEM ---------
  async _installModule(path) {
    if (this.moduleRegistry[path]) {
      if (this.debug) console.log(`📦 Module already installed: ${path}`);
      return this.moduleRegistry[path];
    }

    console.log(`📦 Installing module: ${path}`);
    this.currentFilePath = path;
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const code = await response.text();

      const module = {
        name: null,
        exports: {},
        dependencies: [],
        onLoad: null,
        path: path
      };

      await this._processModuleCode(code, module);

      // Resolve dependencies first
      for (const depPath of module.dependencies) {
        const depModule = await this._installModule(depPath);
        // Merge exports? For now just ensure they're installed.
      }

      // Run onLoad if present
      if (module.onLoad) {
        await this._runJS(module.onLoad, true);
      }

      this.moduleRegistry[path] = module;
      if (module.name) {
        this.moduleExports[module.name] = module.exports;
        console.log(`📦 Module registered: ${module.name}`);
      }

      return module;
    } catch (e) {
      this._error(`Failed to install module ${path}: ${e.message}`, 0, '', true);
    } finally {
      this.currentFilePath = null;
    }
  }

  async _processModuleCode(code, module) {
    const lines = code.split('\n').map(l => l.trimEnd());
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      if (!line || line.startsWith('//')) continue;

      try {
        // Module-specific commands
        if (line.startsWith('hsx module')) {
          // hsx module <name>
          const name = line.replace('hsx module', '').trim();
          module.name = name;
          continue;
        }

        if (line.startsWith('hsx require')) {
          // hsx require "path.module.hsx"
          const match = line.match(/"([^"]+)"/);
          if (match) {
            module.dependencies.push(match[1]);
          } else {
            this._warn('Invalid hsx require syntax', i+1, line);
          }
          continue;
        }

        if (line.startsWith('hsx export const')) {
          // hsx export const NAME value
          const parts = line.replace('hsx export const', '').trim().split(/\s+/);
          const name = parts[0];
          const value = parts.slice(1).join(' ').trim();
          module.exports[name] = this._evaluateExpression(value);
          continue;
        }

        if (line.startsWith('hsx export variable')) {
          // hsx export variable NAME value
          const parts = line.replace('hsx export variable', '').trim().split(/\s+/);
          const name = parts[0];
          let value = parts.slice(1).join(' ').trim();
          // Evaluate as expression
          module.exports[name] = this._evaluateExpression(value);
          continue;
        }

        if (line.startsWith('hsx export function')) {
          // hsx export function NAME (params) { ... }
          // This is complex; we'll capture until a line with just '}'
          const match = line.match(/hsx export function\s+(\w+)\s*\(([^)]*)\)\s*{/);
          if (!match) {
            this._error('Invalid function export syntax', i+1, line);
            continue;
          }
          const name = match[1];
          const params = match[2].split(',').map(p => p.trim()).filter(p => p);
          // Collect function body
          let bodyLines = [];
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('}')) {
            bodyLines.push(lines[i]);
            i++;
          }
          // Create a function from the body (as JS)
          const funcBody = bodyLines.join('\n');
          // Use new Function to create a function with given params
          const func = new Function(...params, funcBody);
          module.exports[name] = func;
          continue;
        }

        if (line.startsWith('hsx on load')) {
          // hsx on load { ... }  (JS block)
          if (line.includes('{')) {
            // Find the opening brace and collect until matching close
            let braceCount = 1;
            let jsLines = [];
            // Check if the opening brace is on this line after the command
            const startIdx = line.indexOf('{');
            if (startIdx !== -1) {
              let partial = line.substring(startIdx + 1);
              if (partial.trim()) jsLines.push(partial);
            }
            i++;
            while (i < lines.length) {
              const l = lines[i];
              for (let ch of l) {
                if (ch === '{') braceCount++;
                if (ch === '}') braceCount--;
              }
              jsLines.push(l);
              i++;
              if (braceCount === 0) break;
            }
            module.onLoad = jsLines.join('\n').replace(/\}$/, '').trim();
          }
          continue;
        }

        if (line.startsWith('hsx description')) {
          // hsx description "text"
          const match = line.match(/"([^"]+)"/);
          if (match) module.description = match[1];
          continue;
        }

        // If line doesn't match any module command, ignore (or warn in debug)
        if (this.debug) {
          this._warn(`Unrecognized line in module file: ${line}`, i+1, line);
        }
      } catch (e) {
        this._error(`Error processing module line: ${e.message}`, i+1, rawLine, false);
      }
    }
  }

  // --------- EXPRESSION EVALUATOR (same as before) ---------
  _evaluateExpression(expr) {
    expr = expr.trim();
    if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
    if (expr === "true") return true;
    if (expr === "false") return false;
    if (!isNaN(expr)) return Number(expr);
    if (expr in this.state) return this.state[expr];
    if (expr.startsWith('[') && expr.endsWith(']')) {
      try {
        const inner = expr.slice(1, -1);
        if (inner.trim() === '') return [];
        return inner.split(',').map(item => this._evaluateExpression(item.trim()));
      } catch (e) {
        this._warn(`Failed to parse array: ${expr}`);
        return [];
      }
    }
    return expr;
  }

  _interpretLine(line, lineNum) {
    line = line.trim();
    if (!line) return;
    if (line.includes('${')) {
      line = line.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        return this.state[varName] !== undefined ? this.state[varName] : '';
      });
      console.log(line);
    } else {
      console.log(line);
    }
  }

  // --------- GAME PIXEL SYSTEM (enhanced) ---------
  startPixelGame() {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    canvas.style.position = "fixed";
    canvas.style.right = "10px";
    canvas.style.bottom = "10px";
    canvas.style.border = "1px solid #888";
    canvas.style.zIndex = 9999;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const pixels = this.gameConfig.pixels;

    setInterval(() => {
      ctx.clearRect(0, 0, 300, 300);
      if (Array.isArray(pixels)) {
        if (typeof pixels[0] === 'string') {
          for (let i = 0; i < 50; i++) {
            ctx.fillStyle = pixels[Math.floor(Math.random() * pixels.length)];
            ctx.fillRect(Math.random() * 300, Math.random() * 300, 5, 5);
          }
        } else {
          pixels.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x || 0, p.y || 0, 5, 5);
          });
        }
      }
    }, 1000 / this.gameConfig.fps);
  }

  // === FULL HELPER METHODS (all preserved and enhanced with error handling) ===
  _extractQuotes(str) { const m = str.match(/"(.*?)"/); return m ? m[1] : ""; }

  _attachMedia(type, src) {
    try {
      const el = document.createElement(type);
      el.src = src;
      if (type === "video" || type === "audio") el.controls = true;
      if (type === "img") el.style.maxWidth = "400px";
      document.body.appendChild(el);
      console.log(`📎 Attached ${type}: ${src}`);
    } catch (e) {
      this._error(`Failed to attach ${type}: ${e.message}`, 0, src);
    }
  }

  _renderComponent(name) {
    if (!this.components[name]) {
      this._warn(`Component not found: ${name}`, 0, '');
      return;
    }
    try {
      const el = document.createElement("div");
      let html = this.components[name];
      html = html.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        return this.state[varName] !== undefined ? this.state[varName] : '';
      });
      el.innerHTML = html;
      document.body.appendChild(el);
      console.log(`✨ Rendered component: ${name}`);
    } catch (e) {
      this._error(`Failed to render component ${name}: ${e.message}`, 0, '');
    }
  }

  async _runJS(code, domSafe = false) {
    try {
      if (domSafe) {
        new Function(`document.addEventListener('DOMContentLoaded',()=>{try{${code}}catch(e){console.error('❌ JS error:',e);}})`)();
      } else {
        new Function(code)();
      }
      console.log("💻 JS executed");
    } catch (e) {
      this._error(`JS error: ${e.message}`, 0, code.split('\n')[0]);
    }
  }

  async _runPy(code) {
    if (!this.pyodide) {
      this._warn("Pyodide not initialized; skipping Python block.", 0, '');
      return;
    }
    try {
      await this.pyodide.runPythonAsync(code);
      console.log("🐍 Python executed");
    } catch (e) {
      this._error(`Python error: ${e.message}`, 0, code.split('\n')[0]);
    }
  }

  async _runHSXBlock(code) {
    if (!this.sandboxed) {
      this._warn("HSX block skipped (sandbox off)", 0, '');
      return;
    }
    const lines = code.split("\n").map(l => l.trim());
    for (let line of lines) {
      if (!line) continue;
      if (line.endsWith(".ps") || line.endsWith(".ks")) {
        await this._runModule(line.trim());
        continue;
      }
      if (line.includes("eq") || line.includes("-") || line.includes(",")) {
        this._parseAttachmentLegacy(line);
        continue;
      }
      if (line.startsWith("hsx:fun")) {
        await this._runFun(line.replace("hsx:fun", "").trim());
        continue;
      }
      if (line.startsWith("{js")) await this._runJS(line.replace("{js", "").replace("}", "").trim());
      else if (line.startsWith("{py")) await this._runPy(line.replace("{py", "").replace("}", "").trim());
      if (this.emotionActive) this._checkEmotions(line);
    }
  }

  _parseAttachmentLegacy(line) {
    const key = line.split("eq")[0].replace("hsx:new", "").trim();
    let val = [];
    if (line.includes(",")) val = line.split("eq")[1].split(",").map(v => v.trim());
    else val = line.split(/eq|-/).slice(1).map(v => v.trim());
    this.attachments[key] = val;
    console.log("📎 Attachment stored:", key, this.attachments[key]);
  }

  async _runModule(name) {
    if (this.modules[name]) {
      try {
        await this.modules[name]();
        console.log(`📦 Module executed: ${name}`);
      } catch (e) {
        this._error(`Module error in ${name}: ${e.message}`, 0, '');
      }
    } else {
      this._warn(`Module not found: ${name}`, 0, '');
    }
  }

  async _handleModules(cmd) {
    if (cmd.startsWith("Load")) return console.log("📦 Modules loaded");
    if (cmd.startsWith("create")) {
      const name = cmd.split(">")[1]?.trim();
      if (name) this.modules[name] = async () => console.log(`📦 Module ${name} executed`);
    }
    if (cmd.startsWith("comb eq")) {
      const mods = cmd.split("eq")[1].split("+").map(m => m.trim());
      this.modules[mods.join("+")] = async () => {
        for (let m of mods) await this._runModule(m);
        console.log(`📦 Combined modules executed: ${mods.join("+")}`);
      };
    }
  }

  async _runFun(code) {
    console.log("🌀 Fun mode running...");
    const lines = code.split(/[\n;]/).map(l => l.trim()).filter(Boolean);
    for (let line of lines) {
      if (!line) continue;
      if (line.endsWith(".ps") || line.endsWith(".ks")) await this._runModule(line);
      else if (line.startsWith("{js")) await this._runJS(line.replace("{js", "").replace("}", "").trim());
      else if (line.startsWith("{py")) await this._runPy(line.replace("{py", "").replace("}", "").trim());
      else {
        try {
          new Function(line)();
          console.log("🌀 Fun fallback executed:", line);
        } catch (e) {
          this._error(`Fun fallback error: ${e.message}`, 0, line);
        }
      }
    }
  }

  async _handleNewHSXCommands(line) {
    if (line.startsWith("(hsx) hsx extract modules")) { console.log("📦 HSX module extraction enabled"); return; }
    if (line.startsWith("(hsx) module extraction")) { console.log("📦 Module extraction flag set"); return; }
    if (line.startsWith("(hsx) create new file")) { console.log(`📄 New file creation: ${line}`); return; }
    if (line.startsWith("(hsx) create new block")) {
      const name = line.replace("(hsx) create new block cal it", "").replace(":)", "").trim();
      this.blocks[name] = { data: {}, code: "" };
      console.log(`🆕 Block created: ${name}`);
      return;
    }
    if (line.startsWith("(hsx) allow data and export")) { this.dataExportActive = true; console.log("📤 Data export enabled"); return; }
    if (line.startsWith("(hsx) allow emotions")) { this.emotionActive = true; console.log("😃 Emotions enabled"); return; }
    if (line.startsWith("(hsx) allow meta data set")) { this.metaActive = true; console.log("📝 Meta data enabled"); return; }
    if (line.startsWith("(hsx) make new meta data tag")) {
      const tag = line.split(":")[1]?.trim();
      if (tag) { this.metaTags[tag] = {}; console.log(`🏷️ Meta tag registered: ${tag}`); }
      return;
    }
    console.log("ℹ️ HSX new command:", line);
  }

  async _handleFunnyBlock(line, lines, i) {
    const name = line.replace("(funny)", "").split(":")[0].trim();
    const contentLines = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith("(funny)")) contentLines.push(lines[j++]);
    this.blocks[name] = { data: {}, code: contentLines.join("\n") };
    console.log(`😂 Funny block created: ${name}`);
  }

  _checkEmotions(line) {
    const symbols = [":)", "(:", "):", ":(", ";)", ";(", ");", "(;", "{:}", ").(:"];
    for (let sym of symbols) {
      if (line.includes(sym)) {
        if (!this.emotions[sym]) console.log(`😊 Emotion triggered: ${sym} in line -> "${line}"`);
        else {
          try { this.emotions[sym](line); } catch (e) { this._error(`Emotion handler error: ${e.message}`, 0, line); }
        }
      }
    }
  }

  async loadFromFile(file) {
    this.currentFilePath = file.name;
    await this.execute(await file.text());
    this.currentFilePath = null;
  }

  async loadFromText(text) {
    await this.execute(text);
  }
}

// Auto-init, drag-drop & auto-load (unchanged)
window.HSXRuntime = HSXRuntime;

window.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.createElement("div");
  dropZone.innerText = "📂 Drop HSX files here";
  dropZone.style.border = "2px dashed #666";
  dropZone.style.padding = "20px";
  dropZone.style.margin = "20px";
  dropZone.style.textAlign = "center";
  document.body.appendChild(dropZone);

  dropZone.addEventListener("dragover", e => e.preventDefault());
  dropZone.addEventListener("drop", async e => {
    e.preventDefault();
    for (const file of e.dataTransfer.files) {
      if (file.name.endsWith(".hsx")) {
        const hsx = new HSXRuntime();
        await hsx.loadFromFile(file);
      }
    }
  });
});

if (location.search.includes("hsxFiles=")) {
  const filesParam = new URLSearchParams(location.search).get("hsxFiles");
  const files = filesParam.split(",");
  const hsx = new HSXRuntime();
  hsx.loadFiles(files);
} else if (location.pathname.endsWith(".hsx")) {
  const hsx = new HSXRuntime();
  hsx.load(location.pathname);
}
