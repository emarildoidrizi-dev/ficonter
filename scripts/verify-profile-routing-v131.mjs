import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const profilePage = read("app/dashboard/profile/page.tsx");
const profileWorkspace = read("components/ProfileWorkspace.tsx");
const settingsPage = read("app/dashboard/settings/page.tsx");
const supplemental = read("components/SettingsSupplementalModules.tsx");
const pwaSettings = read("components/InstalledPwaSettingsWorkspace.tsx");

expect(
  profilePage.includes("<ProfileWorkspace") &&
    profilePage.includes("<ProfileIdentityDetailsForm"),
  "Profile must render as its own dedicated editable workspace.",
);
expect(
  !profilePage.includes("permanentRedirect"),
  "The dedicated Profile route must not redirect into Settings.",
);
expect(
  profileWorkspace.includes('encodeURIComponent("/dashboard/profile")'),
  "Profile email confirmation must return to the dedicated Profile route.",
);
expect(
  settingsPage.includes('if (section === "profile")') &&
    settingsPage.includes('redirect("/dashboard/profile")'),
  "Old Settings Profile URLs must be compatibility redirects only.",
);
expect(
  !supplemental.includes("ProfileIdentityDetailsForm") &&
    !supplemental.includes('section === "profile"'),
  "Settings supplemental modules must not mount Profile content.",
);
expect(
  !pwaSettings.includes('id: "profile"') &&
    !pwaSettings.includes('label: "Profile"'),
  "Installed PWA Settings must contain no Profile option.",
);

console.log("FICONTER dedicated Profile routing verification passed (6/6).");
