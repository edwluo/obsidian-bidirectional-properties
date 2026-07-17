// ============================================================
//  Settings - plugin settings
// ============================================================

import { App, PluginSettingTab, Setting } from "obsidian";
import type BidirectionalPropertiesPlugin from "./main";

export interface BidirectionalPropertiesSettings {
  // Enabled fields
  enableUpDown: boolean;
  enableSame: boolean;
  enableNextPrev: boolean;

  // Behavior
  syncOnStartup: boolean;
  showNotifications: boolean;

  // Excluded folders
  excludeFolders: string;
}

export const DEFAULT_SETTINGS: BidirectionalPropertiesSettings = {
  enableUpDown: true,
  enableSame: true,
  enableNextPrev: true,
  syncOnStartup: false,
  showNotifications: true,
  excludeFolders: "",
};

export class BidirectionalPropertiesSettingTab extends PluginSettingTab {
  plugin: BidirectionalPropertiesPlugin;

  constructor(app: App, plugin: BidirectionalPropertiesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Bidirectional Properties Settings" });

    // ============================================================
    //  Enabled fields
    // ============================================================
    containerEl.createEl("h3", { text: "Enabled Fields" });

    new Setting(containerEl)
      .setName("up ↔ down")
      .setDesc("Sync parent-child relationships")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableUpDown)
          .onChange(async (value) => {
            this.plugin.settings.enableUpDown = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("same ↔ same")
      .setDesc("Sync sibling relationships (symmetric)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableSame)
          .onChange(async (value) => {
            this.plugin.settings.enableSame = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("next ↔ prev")
      .setDesc("Sync sequential relationships")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableNextPrev)
          .onChange(async (value) => {
            this.plugin.settings.enableNextPrev = value;
            await this.plugin.saveSettings();
          })
      );

    // ============================================================
    //  Behavior settings
    // ============================================================
    containerEl.createEl("h3", { text: "Behavior" });

    new Setting(containerEl)
      .setName("Sync on startup")
      .setDesc("Scan and fix all inconsistencies when Obsidian starts")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.syncOnStartup = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show notifications")
      .setDesc("Show notices when syncing properties")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showNotifications)
          .onChange(async (value) => {
            this.plugin.settings.showNotifications = value;
            await this.plugin.saveSettings();
          })
      );

    // ============================================================
    //  Exclusion settings
    // ============================================================
    containerEl.createEl("h3", { text: "Exclusions" });

    new Setting(containerEl)
      .setName("Exclude folders")
      .setDesc("Comma-separated list of folders to exclude (e.g., Templates, Archive)")
      .addText((text) =>
        text
          .setPlaceholder("Templates, Archive")
          .setValue(this.plugin.settings.excludeFolders)
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
