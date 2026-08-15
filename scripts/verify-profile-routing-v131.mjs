import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const profilePage = read("app/dashboard/profile/page.tsx");
const chrome = read("components/FiconterNativeAppChrome.tsx");
const sidebar = read("components/Sidebar.tsx");
const businessSidebar = read("components/BusinessSidebar.tsx");
const settings = read("components/SettingsWorkspace.tsx");
const speed = read("components/NavigationSpeedBoost.tsx");
const sw = read("public/sw.js");
const mobileCss = read("app/mobile-unified-v1.css");

expect(
  profilePage.includes('permanentRedirect("/dashboard/settings?section=profile")'),
  "Legacy /dashboard/profile must permanently redirect to Account preferences.",
);
expect(
  !profilePage.includes("fui-profile-card") && !profilePage.includes("Personal workspace"),
  "Standalone Profile presentation must be permanently removed.",
);
expect(
  !mobileCss.includes("fui-profile-"),
  "Retired standalone Profile styling must also be removed.",
);
expect(
  chrome.includes('href: "/dashboard/settings?section=profile"') &&
    chrome.includes('href="/dashboard/settings?section=profile"'),
  "Mobile Profile entry points must open Account preferences directly.",
);
expect(
  sidebar.includes('openRoute("/dashboard/settings?section=profile")'),
  "Personal desktop Profile action must open Account preferences directly.",
);
expect(
  businessSidebar.includes('href="/dashboard/settings?section=profile"'),
  "Business desktop Profile action must open Account preferences directly.",
);
expect(
  settings.includes('encodeURIComponent("/dashboard/settings?section=profile")'),
  "Email confirmation must return to Profile inside Account preferences.",
);
expect(
  !speed.includes('"/dashboard/profile"'),
  "Navigation prefetch must not warm the retired standalone Profile route.",
);
expect(
  /ficonter-pwa-static-v\d+[^"\n]*v1(?:31|3[2-9]|[4-9]\d)/.test(sw),
  "PWA cache must be versioned for the Profile routing change.",
);

console.log("FICONTER V1.31 Profile routing verification passed (9/9).");
