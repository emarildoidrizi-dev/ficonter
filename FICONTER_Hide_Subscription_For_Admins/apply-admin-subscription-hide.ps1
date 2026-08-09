$ErrorActionPreference = "Stop"

function Find-RepoRoot {
    param([string]$StartPath)
    $current = (Resolve-Path $StartPath).Path
    for ($i = 0; $i -lt 5; $i++) {
        $settingsPage = Join-Path $current "app\dashboard\settings\page.tsx"
        $workspace = Join-Path $current "components\SettingsWorkspace.tsx"
        if ((Test-Path $settingsPage) -and (Test-Path $workspace)) {
            return $current
        }
        $parent = Split-Path $current -Parent
        if ($parent -eq $current -or [string]::IsNullOrWhiteSpace($parent)) { break }
        $current = $parent
    }
    throw "FICONTER repository root not found. Extract this package into the FICONTER repository root, then run APPLY_FIX.bat again."
}

function Replace-Required {
    param(
        [string]$Text,
        [string]$Old,
        [string]$New,
        [string]$Label
    )
    if ($Text.Contains($New)) {
        Write-Host "Already applied: $Label"
        return $Text
    }
    if (-not $Text.Contains($Old)) {
        throw "Could not find expected code for: $Label. Stop without committing and ask ChatGPT for an updated package."
    }
    Write-Host "Applying: $Label"
    return $Text.Replace($Old, $New)
}

$repo = Find-RepoRoot $PSScriptRoot
Write-Host "FICONTER repo: $repo"

$pagePath = Join-Path $repo "app\dashboard\settings\page.tsx"
$workspacePath = Join-Path $repo "components\SettingsWorkspace.tsx"

$page = Get-Content -Raw -Encoding UTF8 $pagePath
$workspace = Get-Content -Raw -Encoding UTF8 $workspacePath

# ---- app/dashboard/settings/page.tsx ----

$page = Replace-Required $page `
'import { getCurrentUser } from "@/lib/auth/currentUser";' `
'import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAdmin } from "@/lib/admin/access";' `
"Admin import"

$page = Replace-Required $page `
'  if (!user) redirect("/login");
  const query = await searchParams;' `
'  if (!user) redirect("/login");

  const { admin } = await requireAdmin();
  const isSubscriptionExempt = Boolean(admin);

  const query = await searchParams;' `
"Admin exemption detection"

$page = Replace-Required $page `
'  const section = Array.isArray(query?.section)
    ? query.section[0]
    : query?.section;

  const { data: subscription } = await supabase' `
'  const section = Array.isArray(query?.section)
    ? query.section[0]
    : query?.section;

  if (isSubscriptionExempt && section === "subscription") {
    redirect("/dashboard/settings?section=profile");
  }

  const { data: subscription } = await supabase' `
"Block direct subscription URL for admins"

$page = Replace-Required $page `
'        subscription={subscription}
      />' `
'        subscription={subscription}
        isSubscriptionExempt={isSubscriptionExempt}
      />' `
"Pass exemption to SettingsWorkspace"

# ---- components/SettingsWorkspace.tsx ----

$workspace = Replace-Required $workspace `
'  subscription?: SubscriptionSnapshot | null;
};' `
'  subscription?: SubscriptionSnapshot | null;
  isSubscriptionExempt?: boolean;
};' `
"Add SettingsWorkspace exemption prop"

$workspace = Replace-Required $workspace `
'export function SettingsWorkspace({ userId, email, metadata, initialSection, subscription }: Props) {' `
'export function SettingsWorkspace({
  userId,
  email,
  metadata,
  initialSection,
  subscription,
  isSubscriptionExempt = false,
}: Props) {' `
"Read exemption prop"

$workspace = Replace-Required $workspace `
'  const [active, setActive] = useState<SectionId>(() =>
    isSectionId(initialSection) ? initialSection : "profile",
  );' `
'  const [active, setActive] = useState<SectionId>(() =>
    isSubscriptionExempt && initialSection === "subscription"
      ? "profile"
      : isSectionId(initialSection)
        ? initialSection
        : "profile",
  );' `
"Safe initial settings section"

$workspace = Replace-Required $workspace `
'  useEffect(() => {
    if (isSectionId(initialSection)) {
      setActive(initialSection);
      setMessage(null);
    }
  }, [initialSection]);' `
'  useEffect(() => {
    if (isSectionId(initialSection)) {
      setActive(
        isSubscriptionExempt && initialSection === "subscription"
          ? "profile"
          : initialSection,
      );
      setMessage(null);
    }
  }, [initialSection, isSubscriptionExempt]);' `
"Keep admin away from subscription section"

$workspace = Replace-Required $workspace `
'  const activeSection = sections.find((section) => section.id === active)!;
const currentPlanCode = normalizeSubscriptionPlan(subscription?.plan_code);' `
'  const visibleSections = isSubscriptionExempt
    ? sections.filter((section) => section.id !== "subscription")
    : sections;

  const activeSection =
    visibleSections.find((section) => section.id === active) ??
    sections.find((section) => section.id === "profile")!;

const currentPlanCode = normalizeSubscriptionPlan(subscription?.plan_code);' `
"Filter subscription navigation for admins"

$workspace = Replace-Required $workspace `
'{sections.map(({ id, label, description, icon: Icon }) => (' `
'{visibleSections.map(({ id, label, description, icon: Icon }) => (' `
"Render only visible settings sections"

$workspace = Replace-Required $workspace `
'{active === "subscription" ? (' `
'{active === "subscription" && !isSubscriptionExempt ? (' `
"Prevent subscription panel rendering for admins"

# Write backups only once
$pageBackup = "$pagePath.admin-hide.bak"
$workspaceBackup = "$workspacePath.admin-hide.bak"
if (-not (Test-Path $pageBackup)) { Copy-Item $pagePath $pageBackup }
if (-not (Test-Path $workspaceBackup)) { Copy-Item $workspacePath $workspaceBackup }

Set-Content -Path $pagePath -Value $page -Encoding UTF8
Set-Content -Path $workspacePath -Value $workspace -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: Subscription plans are now hidden for Owner / Super Admin / Admin."
Write-Host "Normal customers still see Subscription and PayPal plan controls."
Write-Host ""
Write-Host "Recommended commit:"
Write-Host "fix(subscription): hide billing plans from administrators"
Write-Host ""
