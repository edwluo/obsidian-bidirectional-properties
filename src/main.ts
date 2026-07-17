// ============================================================
//  Bidirectional Properties - Obsidian Plugin
//  Automatically sync bidirectional relationships in frontmatter
// ============================================================

import { Plugin, TFile, Notice } from "obsidian";
import { SyncEngine } from "./sync-engine";
import {
  BidirectionalPropertiesSettings,
  BidirectionalPropertiesSettingTab,
  DEFAULT_SETTINGS,
} from "./settings";

export default class BidirectionalPropertiesPlugin extends Plugin {
  settings: BidirectionalPropertiesSettings;
  private syncEngine: SyncEngine;

  async onload(): Promise<void> {
    console.log("Loading Bidirectional Properties plugin");

    // Load settings
    await this.loadSettings();

    // Initialize sync engine
    this.syncEngine = new SyncEngine(this.app, this.settings);

    // Add settings tab
    this.addSettingTab(new BidirectionalPropertiesSettingTab(this.app, this));

    // ============================================================
    //  Register event listeners
    // ============================================================

    // Listen for file saves (vault.on('modify') fires when the file is written to disk)
    // Benefit: only syncs after save, avoiding false triggers from mid-edit state
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.syncEngine.onFileModify(file);
        }
      })
    );

    // Listen for file deletion
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.syncEngine.onFileDelete(file);
        }
      })
    );

    // Listen for file rename
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) {
          this.syncEngine.onFileRename(file, oldPath);
        }
      })
    );

    // ============================================================
    //  Register commands
    // ============================================================

    // Manually sync all files
    this.addCommand({
      id: "sync-all-bidirectional-properties",
      name: "Sync all bidirectional properties",
      callback: async () => {
        new Notice("Scanning for inconsistencies...");
        const fixCount = await this.syncEngine.scanAndFix();
        new Notice(`Fixed ${fixCount} inconsistent relation(s)`);
      },
    });

    // ============================================================
    //  Startup initialization
    // ============================================================

    // Wait for metadataCache to be ready
    this.app.workspace.onLayoutReady(async () => {
      // Initialize cache
      await this.syncEngine.initializeCache();

      // If startup scan is enabled
      if (this.settings.syncOnStartup) {
        const fixCount = await this.syncEngine.scanAndFix();
        if (fixCount > 0 && this.settings.showNotifications) {
          new Notice(`Bidirectional Properties: Fixed ${fixCount} inconsistencies`);
        }
      }
    });
  }

  onunload(): void {
    console.log("Unloading Bidirectional Properties plugin");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Update the sync engine's settings reference
    if (this.syncEngine) {
      this.syncEngine.updateSettings(this.settings);
    }
  }
}
