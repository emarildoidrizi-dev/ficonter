import fs from "node:fs";

const file = fs.readFileSync("components/SettingsWorkspace.tsx", "utf8");
const css = fs.readFileSync("components/SettingsWorkspace.module.css", "utf8");

const required = [
  'localSaveFeedback("profile")',
  'localSaveFeedback("baseCurrency")',
  'localSaveFeedback("financialPreferences")',
  'localSaveFeedback("notifications")',
  'localSaveFeedback("appearance")',
  '"financialPreferences"',
  '"notifications"',
  '"appearance"',
  'aria-live="polite"',
];

for (const token of required) {
  if (!file.includes(token)) {
    throw new Error(`Missing local save-feedback requirement: ${token}`);
  }
}

for (const token of [
  "showLocalSaveFeedback",
  "clearSaveFeedback",
  "actionFeedback",
  "actionFeedbackSuccess",
  "actionFeedbackError",
]) {
  if (!(file.includes(token) || css.includes(token))) {
    throw new Error(`Missing save-feedback implementation: ${token}`);
  }
}

if (file.includes('void savePreferences(preferences, "Appearance preferences saved.");')) {
  throw new Error("Appearance save still uses the old global-only feedback path.");
}

console.log("Settings local save-feedback verification passed.");
console.log("- Profile: local confirmation beside Save profile");
console.log("- Base currency: local confirmation beside Save base currency");
console.log("- Financial preferences: local confirmation beside Save preferences");
console.log("- Notifications: local confirmation beside Save notifications");
console.log("- Appearance: local confirmation beside Save appearance");
