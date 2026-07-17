// ============================================================
//  Sync Engine - core synchronization engine
// ============================================================

import { App, TFile, Notice, CachedMetadata } from "obsidian";
import { getReverseField, RELATION_FIELDS } from "./relation-map";
import type { BidirectionalPropertiesSettings } from "./settings";

/**
 * Parsed relation data
 */
interface RelationData {
  [field: string]: string[];
}

/**
 * Sync Engine - detects changes and synchronizes relations
 */
export class SyncEngine {
  private app: App;
  private settings: BidirectionalPropertiesSettings;
  private processingFiles: Set<string> = new Set();
  private cache: Map<string, RelationData> = new Map();

  constructor(app: App, settings: BidirectionalPropertiesSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update the settings reference
   */
  updateSettings(settings: BidirectionalPropertiesSettings): void {
    this.settings = settings;
  }

  /**
   * Check whether a field is enabled
   */
  private isFieldEnabled(field: string): boolean {
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
  private isExcluded(file: TFile): boolean {
    if (!this.settings.excludeFolders.trim()) {
      return false;
    }
    const excludedFolders = this.settings.excludeFolders
      .split(",")
      .map((f) => f.trim().toLowerCase())
      .filter((f) => f);

    const filePath = file.path.toLowerCase();
    return excludedFolders.some((folder) => filePath.startsWith(folder + "/"));
  }

  /**
   * Parse wikilinks in frontmatter
   */
  private parseLinks(value: unknown): string[] {
    if (!value) return [];

    const items = Array.isArray(value) ? value : [value];
    return items
      .map((item) => {
        if (typeof item !== "string") return null;
        // Matches [[Note]], "[[Note]]", or [[Note|Alias]] format
        const match = item.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
        return match ? match[1] : null;
      })
      .filter((x): x is string => x !== null);
  }

  /**
   * Extract relation data from a file
   */
  private extractRelations(file: TFile): RelationData {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter) return {};

    const relations: RelationData = {};
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
  private diffRelations(
    current: RelationData,
    previous: RelationData
  ): { added: RelationData; removed: RelationData } {
    const added: RelationData = {};
    const removed: RelationData = {};

    // Find additions and removals
    for (const field of RELATION_FIELDS) {
      const currentLinks = current[field] || [];
      const previousLinks = previous[field] || [];

      const addedLinks = currentLinks.filter((l) => !previousLinks.includes(l));
      const removedLinks = previousLinks.filter((l) => !currentLinks.includes(l));

      if (addedLinks.length > 0) added[field] = addedLinks;
      if (removedLinks.length > 0) removed[field] = removedLinks;
    }

    return { added, removed };
  }

  /**
   * Find the file corresponding to a note name
   */
  private findFile(noteName: string): TFile | null {
    // Try a direct match
    const files = this.app.vault.getMarkdownFiles();

    // Exact match (without .md)
    let file = files.find((f) => f.basename === noteName);
    if (file) return file;

    // Try matching with .md
    file = files.find((f) => f.name === noteName + ".md");
    if (file) return file;

    return null;
  }

  /**
   * Add a link to the specified field in the target file
   */
  private async addToField(
    targetNoteName: string,
    field: string,
    linkToAdd: string
  ): Promise<void> {
    const targetFile = this.findFile(targetNoteName);
    if (!targetFile) {
      console.log(`[Bidirectional] Target file not found: ${targetNoteName}`);
      return;
    }

    if (this.isExcluded(targetFile)) return;

    // Prevent recursive processing
    if (this.processingFiles.has(targetFile.path)) return;

    const content = await this.app.vault.read(targetFile);
    const linkValue = `"[[${linkToAdd}]]"`;

    // Check whether it already exists
    const currentRelations = this.extractRelations(targetFile);
    const existingLinks = currentRelations[field] || [];
    if (existingLinks.includes(linkToAdd)) return;

    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      // No frontmatter, create one
      const newFrontmatter = `---\n${field}:\n  - ${linkValue}\n---\n`;
      await this.app.vault.modify(targetFile, newFrontmatter + content);
      return;
    }

    const frontmatterContent = frontmatterMatch[1];
    const restContent = content.slice(frontmatterMatch[0].length);

    // Check whether the field exists
    const fieldRegex = new RegExp(`^${field}:`, "m");
    if (fieldRegex.test(frontmatterContent)) {
      // Field exists, append to the list
      const updatedFrontmatter = frontmatterContent.replace(
        new RegExp(`(${field}:.*?)(\n(?=[a-zA-Z]|---)|$)`, "s"),
        (match, fieldPart, ending) => {
          // Check whether it's single-line or multi-line format
          if (fieldPart.includes("\n  -")) {
            // Multi-line format
            return fieldPart + `\n  - ${linkValue}` + ending;
          } else {
            // Single-line format, convert to multi-line
            const existingValue = fieldPart.replace(`${field}:`, "").trim();
            if (existingValue) {
              return `${field}:\n  - ${existingValue}\n  - ${linkValue}` + ending;
            } else {
              return `${field}:\n  - ${linkValue}` + ending;
            }
          }
        }
      );
      await this.app.vault.modify(
        targetFile,
        `---\n${updatedFrontmatter}\n---${restContent}`
      );
    } else {
      // Field doesn't exist, add a new field
      const updatedFrontmatter = frontmatterContent + `\n${field}:\n  - ${linkValue}`;
      await this.app.vault.modify(
        targetFile,
        `---\n${updatedFrontmatter}\n---${restContent}`
      );
    }
  }

  /**
   * Remove a link from the specified field in the target file
   */
  private async removeFromField(
    targetNoteName: string,
    field: string,
    linkToRemove: string
  ): Promise<void> {
    const targetFile = this.findFile(targetNoteName);
    if (!targetFile) return;

    if (this.isExcluded(targetFile)) return;

    // Prevent recursive processing
    if (this.processingFiles.has(targetFile.path)) return;

    const content = await this.app.vault.read(targetFile);

    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return;

    const frontmatterContent = frontmatterMatch[1];
    const restContent = content.slice(frontmatterMatch[0].length);

    // Remove the link (matches multiple formats)
    const patterns = [
      new RegExp(`\\n\\s*-\\s*"?\\[\\[${linkToRemove}(\\|[^\\]]+)?\\]\\]"?`, "g"),
      new RegExp(`\\n\\s*-\\s*"?${linkToRemove}"?(?=\\n|$)`, "g"),
    ];

    let updatedFrontmatter = frontmatterContent;
    for (const pattern of patterns) {
      updatedFrontmatter = updatedFrontmatter.replace(pattern, "");
    }

    // If the field is now empty, remove it entirely
    updatedFrontmatter = updatedFrontmatter.replace(
      new RegExp(`${field}:\\s*\\n(?=\\S|$)`, "g"),
      ""
    );

    if (updatedFrontmatter !== frontmatterContent) {
      await this.app.vault.modify(
        targetFile,
        `---\n${updatedFrontmatter}\n---${restContent}`
      );
    }
  }

  /**
   * Handle the file modify event
   */
  async onFileModify(file: TFile): Promise<void> {
    if (!file.path.endsWith(".md")) return;
    if (this.isExcluded(file)) return;

    // Prevent recursive triggering
    if (this.processingFiles.has(file.path)) return;

    this.processingFiles.add(file.path);

    try {
      const currentRelations = this.extractRelations(file);
      const previousRelations = this.cache.get(file.path) || {};

      const { added, removed } = this.diffRelations(currentRelations, previousRelations);

      let syncCount = 0;

      // Handle added relations
      for (const [field, targets] of Object.entries(added)) {
        if (!this.isFieldEnabled(field)) continue;
        const reverseField = getReverseField(field);
        if (!reverseField) continue;

        for (const target of targets) {
          await this.addToField(target, reverseField, file.basename);
          syncCount++;
        }
      }

      // Handle removed relations
      for (const [field, targets] of Object.entries(removed)) {
        if (!this.isFieldEnabled(field)) continue;
        const reverseField = getReverseField(field);
        if (!reverseField) continue;

        for (const target of targets) {
          await this.removeFromField(target, reverseField, file.basename);
          syncCount++;
        }
      }

      // Update cache
      this.cache.set(file.path, currentRelations);

      // Show notification
      if (syncCount > 0 && this.settings.showNotifications) {
        new Notice(`Synced ${syncCount} bidirectional relation(s)`);
      }
    } finally {
      // Delay removal to avoid issues from rapid consecutive modifications
      setTimeout(() => {
        this.processingFiles.delete(file.path);
      }, 100);
    }
  }

  /**
   * Initialize the cache (load relation data for all files)
   */
  async initializeCache(): Promise<void> {
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
  async scanAndFix(): Promise<number> {
    const files = this.app.vault.getMarkdownFiles();
    let fixCount = 0;

    for (const file of files) {
      if (this.isExcluded(file)) continue;

      const relations = this.extractRelations(file);

      for (const [field, targets] of Object.entries(relations)) {
        if (!this.isFieldEnabled(field)) continue;
        const reverseField = getReverseField(field);
        if (!reverseField) continue;

        for (const target of targets) {
          const targetFile = this.findFile(target);
          if (!targetFile || this.isExcluded(targetFile)) continue;

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
  async onFileDelete(file: TFile): Promise<void> {
    if (!file.path.endsWith(".md")) return;

    const cachedRelations = this.cache.get(file.path);
    if (!cachedRelations) return;

    // Remove references to this file from all linked files
    for (const [field, targets] of Object.entries(cachedRelations)) {
      const reverseField = getReverseField(field);
      if (!reverseField) continue;

      for (const target of targets) {
        await this.removeFromField(target, reverseField, file.basename);
      }
    }

    // Remove from cache
    this.cache.delete(file.path);
  }

  /**
   * Handle the file rename event
   */
  async onFileRename(file: TFile, oldPath: string): Promise<void> {
    if (!file.path.endsWith(".md")) return;

    const oldBasename = oldPath.split("/").pop()?.replace(".md", "") || "";
    const newBasename = file.basename;

    if (oldBasename === newBasename) return;

    const cachedRelations = this.cache.get(oldPath);
    if (!cachedRelations) return;

    // Update references in all linked files
    for (const [field, targets] of Object.entries(cachedRelations)) {
      const reverseField = getReverseField(field);
      if (!reverseField) continue;

      for (const target of targets) {
        // Remove the old reference
        await this.removeFromField(target, reverseField, oldBasename);
        // Add the new reference
        await this.addToField(target, reverseField, newBasename);
      }
    }

    // Update cache
    this.cache.delete(oldPath);
    this.cache.set(file.path, this.extractRelations(file));
  }
}
