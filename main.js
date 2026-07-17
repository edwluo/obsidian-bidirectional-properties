var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => BidirectionalPropertiesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/sync-engine.ts
var import_obsidian = require("obsidian");

// src/relation-map.ts
var RELATION_MAP = {
  up: "down",
  down: "up",
  same: "same",
  next: "prev",
  prev: "next"
};
var RELATION_FIELDS = Object.keys(RELATION_MAP);
function getReverseField(field) {
  return RELATION_MAP[field];
}

// src/sync-engine.ts
var SyncEngine = class {
  constructor(app, settings) {
    this.processingFiles = /* @__PURE__ */ new Set();
    this.cache = /* @__PURE__ */ new Map();
    this.app = app;
    this.settings = settings;
  }
  /**
   * Update the settings reference
   */
  updateSettings(settings) {
    this.settings = settings;
  }
  /**
   * Check whether a field is enabled
   */
  isFieldEnabled(field) {
    if (field === "up" || field === "down") {
      return this.settings.enableUpDown;
    }
    if (field === "same") {
      return this.settings.enableSame;
    }
    if (field === "next" || field === "prev") {
      return this.settings.enableNextPrev;
    }
    return false;
  }
  /**
   * Check whether a file should be excluded
   */
  isExcluded(file) {
    if (!this.settings.excludeFolders.trim()) {
      return false;
    }
    const excludedFolders = this.settings.excludeFolders.split(",").map((f) => f.trim().toLowerCase()).filter((f) => f);
    const filePath = file.path.toLowerCase();
    return excludedFolders.some((folder) => filePath.startsWith(folder + "/"));
  }
  /**
   * Parse wikilinks in frontmatter
   */
  parseLinks(value) {
    if (!value)
      return [];
    const items = Array.isArray(value) ? value : [value];
    return items.map((item) => {
      if (typeof item !== "string")
        return null;
      const match = item.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
      return match ? match[1] : null;
    }).filter((x) => x !== null);
  }
  /**
   * Extract relation data from a file
   */
  extractRelations(file) {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache == null ? void 0 : cache.frontmatter;
    if (!frontmatter)
      return {};
    const relations = {};
    for (const field of RELATION_FIELDS) {
      if (frontmatter[field]) {
        relations[field] = this.parseLinks(frontmatter[field]);
      }
    }
    return relations;
  }
  /**
   * Compute the diff between two sets of relation data
   */
  diffRelations(current, previous) {
    const added = {};
    const removed = {};
    for (const field of RELATION_FIELDS) {
      const currentLinks = current[field] || [];
      const previousLinks = previous[field] || [];
      const addedLinks = currentLinks.filter((l) => !previousLinks.includes(l));
      const removedLinks = previousLinks.filter((l) => !currentLinks.includes(l));
      if (addedLinks.length > 0)
        added[field] = addedLinks;
      if (removedLinks.length > 0)
        removed[field] = removedLinks;
    }
    return { added, removed };
  }
  /**
   * Find the file corresponding to a note name
   */
  findFile(noteName) {
    const files = this.app.vault.getMarkdownFiles();
    let file = files.find((f) => f.basename === noteName);
    if (file)
      return file;
    file = files.find((f) => f.name === noteName + ".md");
    if (file)
      return file;
    return null;
  }
  /**
   * Add a link to the specified field in the target file
   */
  async addToField(targetNoteName, field, linkToAdd) {
    const targetFile = this.findFile(targetNoteName);
    if (!targetFile) {
      console.log(`[Bidirectional] Target file not found: ${targetNoteName}`);
      return;
    }
    if (this.isExcluded(targetFile))
      return;
    if (this.processingFiles.has(targetFile.path))
      return;
    const content = await this.app.vault.read(targetFile);
    const linkValue = `"[[${linkToAdd}]]"`;
    const currentRelations = this.extractRelations(targetFile);
    const existingLinks = currentRelations[field] || [];
    if (existingLinks.includes(linkToAdd))
      return;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      const newFrontmatter = `---
${field}:
  - ${linkValue}
---
`;
      await this.app.vault.modify(targetFile, newFrontmatter + content);
      return;
    }
    const frontmatterContent = frontmatterMatch[1];
    const restContent = content.slice(frontmatterMatch[0].length);
    const fieldRegex = new RegExp(`^${field}:`, "m");
    if (fieldRegex.test(frontmatterContent)) {
      const updatedFrontmatter = frontmatterContent.replace(
        new RegExp(`(${field}:.*?)(
(?=[a-zA-Z]|---)|$)`, "s"),
        (match, fieldPart, ending) => {
          if (fieldPart.includes("\n  -")) {
            return fieldPart + `
  - ${linkValue}` + ending;
          } else {
            const existingValue = fieldPart.replace(`${field}:`, "").trim();
            if (existingValue) {
              return `${field}:
  - ${existingValue}
  - ${linkValue}` + ending;
            } else {
              return `${field}:
  - ${linkValue}` + ending;
            }
          }
        }
      );
      await this.app.vault.modify(
        targetFile,
        `---
${updatedFrontmatter}
---${restContent}`
      );
    } else {
      const updatedFrontmatter = frontmatterContent + `
${field}:
  - ${linkValue}`;
      await this.app.vault.modify(
        targetFile,
        `---
${updatedFrontmatter}
---${restContent}`
      );
    }
  }
  /**
   * Remove a link from the specified field in the target file
   */
  async removeFromField(targetNoteName, field, linkToRemove) {
    const targetFile = this.findFile(targetNoteName);
    if (!targetFile)
      return;
    if (this.isExcluded(targetFile))
      return;
    if (this.processingFiles.has(targetFile.path))
      return;
    const content = await this.app.vault.read(targetFile);
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch)
      return;
    const frontmatterContent = frontmatterMatch[1];
    const restContent = content.slice(frontmatterMatch[0].length);
    const patterns = [
      new RegExp(`\\n\\s*-\\s*"?\\[\\[${linkToRemove}(\\|[^\\]]+)?\\]\\]"?`, "g"),
      new RegExp(`\\n\\s*-\\s*"?${linkToRemove}"?(?=\\n|$)`, "g")
    ];
    let updatedFrontmatter = frontmatterContent;
    for (const pattern of patterns) {
      updatedFrontmatter = updatedFrontmatter.replace(pattern, "");
    }
    updatedFrontmatter = updatedFrontmatter.replace(
      new RegExp(`${field}:\\s*\\n(?=\\S|$)`, "g"),
      ""
    );
    if (updatedFrontmatter !== frontmatterContent) {
      await this.app.vault.modify(
        targetFile,
        `---
${updatedFrontmatter}
---${restContent}`
      );
    }
  }
  /**
   * Handle the file modify event
   */
  async onFileModify(file) {
    if (!file.path.endsWith(".md"))
      return;
    if (this.isExcluded(file))
      return;
    if (this.processingFiles.has(file.path))
      return;
    this.processingFiles.add(file.path);
    try {
      const currentRelations = this.extractRelations(file);
      const previousRelations = this.cache.get(file.path) || {};
      const { added, removed } = this.diffRelations(currentRelations, previousRelations);
      let syncCount = 0;
      for (const [field, targets] of Object.entries(added)) {
        if (!this.isFieldEnabled(field))
          continue;
        const reverseField = getReverseField(field);
        if (!reverseField)
          continue;
        for (const target of targets) {
          await this.addToField(target, reverseField, file.basename);
          syncCount++;
        }
      }
      for (const [field, targets] of Object.entries(removed)) {
        if (!this.isFieldEnabled(field))
          continue;
        const reverseField = getReverseField(field);
        if (!reverseField)
          continue;
        for (const target of targets) {
          await this.removeFromField(target, reverseField, file.basename);
          syncCount++;
        }
      }
      this.cache.set(file.path, currentRelations);
      if (syncCount > 0 && this.settings.showNotifications) {
        new import_obsidian.Notice(`Synced ${syncCount} bidirectional relation(s)`);
      }
    } finally {
      setTimeout(() => {
        this.processingFiles.delete(file.path);
      }, 100);
    }
  }
  /**
   * Initialize the cache (load relation data for all files)
   */
  async initializeCache() {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      if (!this.isExcluded(file)) {
        const relations = this.extractRelations(file);
        this.cache.set(file.path, relations);
      }
    }
  }
  /**
   * Full scan and fix inconsistencies
   */
  async scanAndFix() {
    const files = this.app.vault.getMarkdownFiles();
    let fixCount = 0;
    for (const file of files) {
      if (this.isExcluded(file))
        continue;
      const relations = this.extractRelations(file);
      for (const [field, targets] of Object.entries(relations)) {
        if (!this.isFieldEnabled(field))
          continue;
        const reverseField = getReverseField(field);
        if (!reverseField)
          continue;
        for (const target of targets) {
          const targetFile = this.findFile(target);
          if (!targetFile || this.isExcluded(targetFile))
            continue;
          const targetRelations = this.extractRelations(targetFile);
          const reverseLinks = targetRelations[reverseField] || [];
          if (!reverseLinks.includes(file.basename)) {
            await this.addToField(target, reverseField, file.basename);
            fixCount++;
          }
        }
      }
    }
    return fixCount;
  }
  /**
   * Handle the file delete event
   */
  async onFileDelete(file) {
    if (!file.path.endsWith(".md"))
      return;
    const cachedRelations = this.cache.get(file.path);
    if (!cachedRelations)
      return;
    for (const [field, targets] of Object.entries(cachedRelations)) {
      const reverseField = getReverseField(field);
      if (!reverseField)
        continue;
      for (const target of targets) {
        await this.removeFromField(target, reverseField, file.basename);
      }
    }
    this.cache.delete(file.path);
  }
  /**
   * Handle the file rename event
   */
  async onFileRename(file, oldPath) {
    var _a;
    if (!file.path.endsWith(".md"))
      return;
    const oldBasename = ((_a = oldPath.split("/").pop()) == null ? void 0 : _a.replace(".md", "")) || "";
    const newBasename = file.basename;
    if (oldBasename === newBasename)
      return;
    const cachedRelations = this.cache.get(oldPath);
    if (!cachedRelations)
      return;
    for (const [field, targets] of Object.entries(cachedRelations)) {
      const reverseField = getReverseField(field);
      if (!reverseField)
        continue;
      for (const target of targets) {
        await this.removeFromField(target, reverseField, oldBasename);
        await this.addToField(target, reverseField, newBasename);
      }
    }
    this.cache.delete(oldPath);
    this.cache.set(file.path, this.extractRelations(file));
  }
};

// src/settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  enableUpDown: true,
  enableSame: true,
  enableNextPrev: true,
  syncOnStartup: false,
  showNotifications: true,
  excludeFolders: ""
};
var BidirectionalPropertiesSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Bidirectional Properties Settings" });
    containerEl.createEl("h3", { text: "Enabled Fields" });
    new import_obsidian2.Setting(containerEl).setName("up \u2194 down").setDesc("Sync parent-child relationships").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableUpDown).onChange(async (value) => {
        this.plugin.settings.enableUpDown = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("same \u2194 same").setDesc("Sync sibling relationships (symmetric)").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableSame).onChange(async (value) => {
        this.plugin.settings.enableSame = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("next \u2194 prev").setDesc("Sync sequential relationships").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableNextPrev).onChange(async (value) => {
        this.plugin.settings.enableNextPrev = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Behavior" });
    new import_obsidian2.Setting(containerEl).setName("Sync on startup").setDesc("Scan and fix all inconsistencies when Obsidian starts").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.syncOnStartup).onChange(async (value) => {
        this.plugin.settings.syncOnStartup = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Show notifications").setDesc("Show notices when syncing properties").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showNotifications).onChange(async (value) => {
        this.plugin.settings.showNotifications = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Exclusions" });
    new import_obsidian2.Setting(containerEl).setName("Exclude folders").setDesc("Comma-separated list of folders to exclude (e.g., Templates, Archive)").addText(
      (text) => text.setPlaceholder("Templates, Archive").setValue(this.plugin.settings.excludeFolders).onChange(async (value) => {
        this.plugin.settings.excludeFolders = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/main.ts
var BidirectionalPropertiesPlugin = class extends import_obsidian3.Plugin {
  async onload() {
    console.log("Loading Bidirectional Properties plugin");
    await this.loadSettings();
    this.syncEngine = new SyncEngine(this.app, this.settings);
    this.addSettingTab(new BidirectionalPropertiesSettingTab(this.app, this));
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian3.TFile) {
          this.syncEngine.onFileModify(file);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof import_obsidian3.TFile) {
          this.syncEngine.onFileDelete(file);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof import_obsidian3.TFile) {
          this.syncEngine.onFileRename(file, oldPath);
        }
      })
    );
    this.addCommand({
      id: "sync-all-bidirectional-properties",
      name: "Sync all bidirectional properties",
      callback: async () => {
        new import_obsidian3.Notice("Scanning for inconsistencies...");
        const fixCount = await this.syncEngine.scanAndFix();
        new import_obsidian3.Notice(`Fixed ${fixCount} inconsistent relation(s)`);
      }
    });
    this.app.workspace.onLayoutReady(async () => {
      await this.syncEngine.initializeCache();
      if (this.settings.syncOnStartup) {
        const fixCount = await this.syncEngine.scanAndFix();
        if (fixCount > 0 && this.settings.showNotifications) {
          new import_obsidian3.Notice(`Bidirectional Properties: Fixed ${fixCount} inconsistencies`);
        }
      }
    });
  }
  onunload() {
    console.log("Unloading Bidirectional Properties plugin");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    if (this.syncEngine) {
      this.syncEngine.updateSettings(this.settings);
    }
  }
};
