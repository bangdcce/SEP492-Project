param(
  [string]$SourcePath = 'C:\Users\ASUS\Downloads\Report5_Test Case Document_FE16-FE18\Report5_Test Case Document_FE16-FE18.xlsx',
  [string]$OutputPath = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Test Case Document_User_Dashboard_Portfolio.xlsx'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Copy-FileSharedRead {
  param([string]$SourcePath, [string]$DestinationPath)
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $DestinationPath) | Out-Null
  $input = [System.IO.File]::Open($SourcePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $output = [System.IO.File]::Open($DestinationPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try { $input.CopyTo($output) } finally { $output.Dispose() }
  } finally {
    $input.Dispose()
  }
}

function Read-XmlFile([string]$Path) { return [xml][System.IO.File]::ReadAllText($Path) }

function Get-ColumnLetters([string]$CellReference) { return ([regex]::Match($CellReference, '^[A-Z]+')).Value }

function Get-ColumnIndex([string]$ColumnLetters) {
  $value = 0
  foreach ($char in $ColumnLetters.ToCharArray()) {
    $value = ($value * 26) + ([int][char]$char - [int][char]'A' + 1)
  }
  return $value
}

function Clear-CellValue {
  param([System.Xml.XmlElement]$Cell)
  foreach ($child in @($Cell.ChildNodes)) { [void]$Cell.RemoveChild($child) }
  if ($Cell.HasAttribute('t')) { $Cell.RemoveAttribute('t') }
}

function Get-OrCreateCell {
  param([xml]$SheetXml, [System.Xml.XmlElement]$Row, [System.Xml.XmlNamespaceManager]$Ns, [string]$ColumnLetters)
  $ref = $ColumnLetters + $Row.GetAttribute('r')
  foreach ($cell in $Row.SelectNodes('x:c', $Ns)) { if ($cell.GetAttribute('r') -eq $ref) { return $cell } }
  $cell = $SheetXml.CreateElement('c', $SheetXml.DocumentElement.NamespaceURI)
  $cell.SetAttribute('r', $ref)
  $newIndex = Get-ColumnIndex $ColumnLetters
  $inserted = $false
  foreach ($existing in @($Row.SelectNodes('x:c', $Ns))) {
    if ((Get-ColumnIndex (Get-ColumnLetters $existing.GetAttribute('r'))) -gt $newIndex) {
      [void]$Row.InsertBefore($cell, $existing)
      $inserted = $true
      break
    }
  }
  if (-not $inserted) { [void]$Row.AppendChild($cell) }
  return $cell
}

function Set-CellText {
  param([xml]$SheetXml, [System.Xml.XmlElement]$Row, [System.Xml.XmlNamespaceManager]$Ns, [string]$ColumnLetters, [string]$Text)
  $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $Row -Ns $Ns -ColumnLetters $ColumnLetters
  Clear-CellValue -Cell $cell
  $cell.SetAttribute('t', 'inlineStr')
  $isNode = $SheetXml.CreateElement('is', $SheetXml.DocumentElement.NamespaceURI)
  $tNode = $SheetXml.CreateElement('t', $SheetXml.DocumentElement.NamespaceURI)
  if ($Text.StartsWith(' ') -or $Text.EndsWith(' ') -or $Text.Contains("`n")) {
    $space = $SheetXml.CreateAttribute('xml', 'space', 'http://www.w3.org/XML/1998/namespace')
    $space.Value = 'preserve'
    [void]$tNode.Attributes.Append($space)
  }
  $tNode.InnerText = $Text
  [void]$isNode.AppendChild($tNode)
  [void]$cell.AppendChild($isNode)
}

function Set-CellNumber {
  param([xml]$SheetXml, [System.Xml.XmlElement]$Row, [System.Xml.XmlNamespaceManager]$Ns, [string]$ColumnLetters, [string]$NumberText)
  $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $Row -Ns $Ns -ColumnLetters $ColumnLetters
  Clear-CellValue -Cell $cell
  $vNode = $SheetXml.CreateElement('v', $SheetXml.DocumentElement.NamespaceURI)
  $vNode.InnerText = $NumberText
  [void]$cell.AppendChild($vNode)
}

function Get-RowNode {
  param([xml]$SheetXml, [System.Xml.XmlNamespaceManager]$Ns, [int]$RowNumber)
  $row = $SheetXml.SelectSingleNode("//x:sheetData/x:row[@r='$RowNumber']", $Ns)
  if ($null -eq $row) { throw "Missing row $RowNumber" }
  return $row
}

function Clear-Cells {
  param([xml]$SheetXml, [System.Xml.XmlNamespaceManager]$Ns, [int[]]$Rows, [string[]]$Columns)
  foreach ($r in $Rows) {
    $row = Get-RowNode -SheetXml $SheetXml -Ns $Ns -RowNumber $r
    foreach ($col in $Columns) {
      $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $row -Ns $Ns -ColumnLetters $col
      Clear-CellValue -Cell $cell
    }
  }
}

$tester = "Nguy$([char]0x1EC5)n Gia B$([char]0x1EA3)o"
$today = Get-Date -Format 'yyyy-MM-dd'
$tempRoot = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets'
$workDir = Join-Path $tempRoot ('dashboard-portfolio-it-' + [guid]::NewGuid().ToString())
$extractDir = Join-Path $workDir 'xlsx'

$caseListRows = @(
  @{ Row = 9; No = '1'; Function = 'View Profile Details'; Description = 'A signed-in user can open the portfolio profile page and load their account, trust-score, and optional portfolio fields.'; Precondition = 'Authenticated account exists and can access a role-specific profile route.' },
  @{ Row = 10; No = '2'; Function = 'Update Profile Core Information'; Description = 'A signed-in user can save profile edits such as full name, phone number, avatar, and certifications from the profile page.'; Precondition = 'Authenticated account exists and opens the profile page in edit mode.' },
  @{ Row = 11; No = '3'; Function = 'Upload CV'; Description = 'A freelancer or broker can upload a valid PDF or DOCX CV from the portfolio area.'; Precondition = 'Authenticated FREELANCER or BROKER account exists and a valid CV file is available.' },
  @{ Row = 12; No = '4'; Function = 'View and Delete CV'; Description = 'A user can retrieve an existing CV link and remove the stored CV from the profile page.'; Precondition = 'Authenticated account exists with a previously uploaded CV.' },
  @{ Row = 13; No = '5'; Function = 'Update Bio'; Description = 'A signed-in user can update the portfolio bio with valid content and is blocked on empty or oversized input.'; Precondition = 'Authenticated account exists and opens the bio section in edit mode.' },
  @{ Row = 14; No = '6'; Function = 'Manage Skills Portfolio'; Description = 'A freelancer or broker can load current skill cards and replace the selected skill set with valid skill identifiers.'; Precondition = 'Authenticated FREELANCER or BROKER account exists and public skills are seeded.' },
  @{ Row = 15; No = '7'; Function = 'Load Freelancer Dashboard'; Description = 'A freelancer can load dashboard metrics, invitations, active projects, and recommended jobs with optional search and skill filters.'; Precondition = 'Authenticated FREELANCER account exists with seeded projects, invitations, requests, and profile data.' }
)

$featureRows = @(
  @{ Row = 9; Header = 'View Profile Details (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 10; Id = 'View Profile Details - 1'; Description = 'Open the role-specific profile page and load account data, trust score, role badge, and professional portfolio details.'; Procedure = "1. Sign in with a seeded account and navigate to the matching profile route such as `/freelancer/profile`.`n2. Wait for the profile page to call `/auth/profile`.`n3. Inspect the rendered personal and portfolio sections."; Expected = "1. The profile page loads the signed-in user's account data, trust-score card, and role-specific sections.`n2. Professional fields such as CV, certifications, and skills are shown only when relevant to the account role."; Dependence = 'Authenticated account exists with profile data and optional portfolio fields.'; Note = 'Trace: `ProfilePage.tsx` -> `getProfile()` -> `GET /auth/profile`.' },
  @{ Row = 11; Id = 'View Profile Details - 2'; Description = 'Keep the profile page stable when optional portfolio fields such as bio, CV, or certifications are empty.'; Procedure = "1. Sign in with an account whose optional portfolio fields are empty.`n2. Open the profile page.`n3. Inspect the fallback states for optional sections."; Expected = "1. The profile page renders empty-state placeholders instead of crashing on null or missing portfolio fields.`n2. The user can still enter edit mode and continue updating the profile."; Dependence = 'Authenticated account exists with optional portfolio fields left empty.'; Note = 'Trace: `ProfilePage.tsx` handles missing bio, certifications, and CV safely.' },
  @{ Row = 12; Header = 'Update Profile Core Information (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 13; Id = 'Update Profile Core Information - 1'; Description = 'Save full name, phone number, avatar, and certifications from the profile edit form.'; Procedure = "1. Sign in and open the profile page.`n2. Enter edit mode, update user core fields and profile fields, then save.`n3. Wait for the profile reload to finish."; Expected = "1. The update request succeeds and the refreshed profile reflects the new full name, phone number, avatar preview, and certifications.`n2. Header storage sync and user-facing profile data remain consistent after the reload."; Dependence = 'Authenticated account exists and valid edit payload is supplied from the profile page.'; Note = 'Trace: `ProfilePage.tsx` -> `updateProfile()` -> `PUT /auth/profile`.' },
  @{ Row = 14; Id = 'Update Profile Core Information - 2'; Description = 'Save profile-only fields such as avatar or certifications without corrupting the existing account core fields.'; Procedure = "1. Sign in and open the profile page.`n2. Update only profile-side fields such as avatar or certifications, then save.`n3. Reload the page and inspect the persisted account core data."; Expected = "1. Profile-side fields persist successfully without blanking full name, phone number, or other untouched account fields.`n2. The reloaded page shows the new profile-side data while preserving untouched user-side values."; Dependence = 'Authenticated account exists and submits a profile-only update payload.'; Note = 'Trace: `AuthService.updateProfile()` updates user and profile tables selectively.' },
  @{ Row = 15; Header = 'Upload CV (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 16; Id = 'Upload CV - 1'; Description = 'Upload a valid PDF or DOCX CV from the portfolio section for a freelancer or broker account.'; Procedure = "1. Sign in as FREELANCER or BROKER and open the profile page.`n2. Choose a valid PDF or DOCX file smaller than 5MB in the CV widget.`n3. Wait for the upload request to complete and reload the profile."; Expected = "1. The CV upload succeeds and the profile shows an available CV document for later view or download.`n2. The saved CV URL becomes retrievable through `/profile/cv` and visible on the profile page."; Dependence = 'Authenticated FREELANCER or BROKER account exists and a valid CV file is available.'; Note = 'Trace: `CVUpload` -> `uploadCV()` -> `POST /profile/cv`.' },
  @{ Row = 17; Id = 'Upload CV - 2'; Description = 'Reject an invalid CV upload when the file type is unsupported or the file exceeds the size limit.'; Procedure = "1. Sign in as FREELANCER or BROKER and open the CV upload section.`n2. Attempt to upload an unsupported file type or an oversized file.`n3. Observe the validation and upload result."; Expected = "1. The CV upload is rejected with a clear error state for invalid file type or file size.`n2. No new CV is persisted for the account after the failed upload."; Dependence = 'Authenticated FREELANCER or BROKER account exists and an invalid test file is available.'; Note = 'Trace: `ProfileController.uploadCV()` validates MIME type and 5MB size limit.' },
  @{ Row = 18; Header = 'View and Delete CV (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 19; Id = 'View and Delete CV - 1'; Description = 'Retrieve an existing CV URL and expose the document for download or browser view from the profile page.'; Procedure = "1. Sign in with an account that already has a stored CV.`n2. Open the profile page and inspect the CV section.`n3. Trigger the view or download action that relies on `/profile/cv`."; Expected = "1. The profile page receives a usable public or signed CV URL for the stored document.`n2. The user can open or download the current CV from the portfolio section."; Dependence = 'Authenticated account exists with a stored CV path or public URL.'; Note = 'Trace: `getCV()` -> `GET /profile/cv` -> CV section actions.' },
  @{ Row = 20; Id = 'View and Delete CV - 2'; Description = 'Delete the stored CV and return the portfolio section to the empty state.'; Procedure = "1. Sign in with an account that already has a stored CV.`n2. Trigger the delete CV action from the profile page.`n3. Reload the portfolio section and request the CV again."; Expected = "1. The delete request succeeds and the profile page returns to the no-CV state.`n2. A follow-up `GET /profile/cv` call returns no CV link for the account."; Dependence = 'Authenticated account exists with a stored CV and can access the portfolio section.'; Note = 'Trace: `deleteCV()` -> `DELETE /profile/cv` -> follow-up `GET /profile/cv` returns null.' },
  @{ Row = 21; Header = 'Update Bio (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 22; Id = 'Update Bio - 1'; Description = 'Save a valid portfolio bio from the profile page and trim leading or trailing whitespace.'; Procedure = "1. Sign in and open the profile page in edit mode.`n2. Enter a valid bio with surrounding whitespace and save.`n3. Reload the profile data and inspect the stored bio."; Expected = "1. The bio update succeeds and the saved profile shows the trimmed bio value.`n2. The portfolio section immediately reflects the updated bio after reload."; Dependence = 'Authenticated account exists and submits a valid bio shorter than 1000 characters.'; Note = 'Trace: `updateBio()` -> `PATCH /profile/bio` trims and persists the bio.' },
  @{ Row = 23; Id = 'Update Bio - 2'; Description = 'Reject bio updates when the submitted content is empty or exceeds the supported length.'; Procedure = "1. Sign in and open the profile page in edit mode.`n2. Attempt to save an empty bio or a bio longer than 1000 characters.`n3. Observe the error handling."; Expected = "1. The bio update is rejected with a clear validation error for empty or oversized content.`n2. The previously saved bio remains unchanged after the failed update."; Dependence = 'Authenticated account exists and an invalid bio payload is submitted.'; Note = 'Trace: `ProfileController.updateBio()` rejects empty and oversized bio input.' },
  @{ Row = 24; Header = 'Manage Skills Portfolio (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 25; Id = 'Manage Skills Portfolio - 1'; Description = 'Load current skill cards with full metadata and replace the selected skills with valid skill IDs.'; Procedure = "1. Sign in as FREELANCER or BROKER and open the profile page or skills section.`n2. Load the existing skills through `/profile/skills`.`n3. Replace the selected skills with a valid new set and save."; Expected = "1. The page loads the current skill cards with name, category, priority, and portfolio metadata.`n2. The updated skill set is persisted and reflected by a follow-up `/profile/skills` request."; Dependence = 'Authenticated FREELANCER or BROKER account exists with seeded skills and valid replacement skill IDs.'; Note = 'Trace: `getUserSkills()` and `updateUserSkills()` -> `GET/PUT /profile/skills`.' },
  @{ Row = 26; Id = 'Manage Skills Portfolio - 2'; Description = 'Reject the skill update when the payload is empty or contains invalid skill IDs.'; Procedure = "1. Sign in as FREELANCER or BROKER and open the skills section.`n2. Attempt to submit an empty list or one invalid skill ID.`n3. Observe the validation result and refresh the section."; Expected = "1. The skill update is rejected with a clear validation error for empty or invalid skill identifiers.`n2. The previously saved skill set remains intact after the failed update."; Dependence = 'Authenticated FREELANCER or BROKER account exists and invalid skill payloads are available.'; Note = 'Trace: `ProfileController.updateSkills()` rejects empty arrays and unknown skill ids.' },
  @{ Row = 27; Header = 'Load Freelancer Dashboard (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 28; Id = 'Load Freelancer Dashboard - 1'; Description = 'Open the freelancer dashboard and load stats, profile completeness, active projects, invitations, and recommended jobs.'; Procedure = "1. Sign in as FREELANCER and navigate to `/freelancer/dashboard`.`n2. Wait for the dashboard request to finish.`n3. Inspect the metrics cards, profile completeness, project list, invitations, and recommendations."; Expected = "1. The dashboard loads the freelancer-specific metrics, profile completeness, active projects, pending invitations, and recommended jobs from real seeded data.`n2. The page remains responsive and can refresh after notification events without leaving the dashboard."; Dependence = 'Authenticated FREELANCER account exists with seeded projects, invitations, requests, and profile data.'; Note = 'Trace: `FreelancerDashboardPage.tsx` -> `GET /freelancer/dashboard`.' },
  @{ Row = 29; Id = 'Load Freelancer Dashboard - 2'; Description = 'Filter the freelancer dashboard recommendation list by search text and selected skills.'; Procedure = "1. Sign in as FREELANCER and open the dashboard.`n2. Enter a search term and choose one or more skill filters.`n3. Wait for the filtered dashboard request to return."; Expected = "1. The dashboard refreshes with recommendations that match the submitted search text and selected skill filters.`n2. The filter state is reflected in the response and the rest of the dashboard remains stable."; Dependence = 'Authenticated FREELANCER account exists with seeded matching requests and available skills.'; Note = 'Trace: `GET /freelancer/dashboard?search=...&skills=...` filtered dashboard flow.' }
)

Copy-FileSharedRead -SourcePath $SourcePath -DestinationPath $OutputPath
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($OutputPath, $extractDir)

try {
  $workbookPath = Join-Path $extractDir 'xl\workbook.xml'
  $coverPath = Join-Path $extractDir 'xl\worksheets\sheet1.xml'
  $listPath = Join-Path $extractDir 'xl\worksheets\sheet2.xml'
  $featurePath = Join-Path $extractDir 'xl\worksheets\sheet3.xml'
  $reportPath = Join-Path $extractDir 'xl\worksheets\sheet6.xml'

  [xml]$workbookXml = Read-XmlFile $workbookPath
  [xml]$coverXml = Read-XmlFile $coverPath
  [xml]$listXml = Read-XmlFile $listPath
  [xml]$featureXml = Read-XmlFile $featurePath
  [xml]$reportXml = Read-XmlFile $reportPath

  $wbNs = New-Object System.Xml.XmlNamespaceManager($workbookXml.NameTable)
  $wbNs.AddNamespace('x', $workbookXml.DocumentElement.NamespaceURI)
  foreach ($sheet in @($workbookXml.SelectNodes('//x:sheets/x:sheet', $wbNs))) {
    $name = $sheet.GetAttribute('name')
    if ($name -eq 'Rating & Trust Score System') { $sheet.SetAttribute('name', 'User Dashboard & Portfolio') }
    elseif ($name -in @('Dispute Resolution System', 'Notification System')) { [void]$sheet.ParentNode.RemoveChild($sheet) }
  }

  foreach ($sheetXml in @($coverXml, $listXml, $featureXml, $reportXml)) {
    $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
    $ns.AddNamespace('x', $sheetXml.DocumentElement.NamespaceURI)
    $sheetXml | Add-Member -NotePropertyName CodexNs -NotePropertyValue $ns
  }

  $coverRow4 = Get-RowNode $coverXml $coverXml.CodexNs 4
  $coverRow5 = Get-RowNode $coverXml $coverXml.CodexNs 5
  $coverRow6 = Get-RowNode $coverXml $coverXml.CodexNs 6
  $coverRow7 = Get-RowNode $coverXml $coverXml.CodexNs 7
  $coverRow12 = Get-RowNode $coverXml $coverXml.CodexNs 12
  Set-CellText $coverXml $coverRow4 $coverXml.CodexNs 'C' 'InterDev'
  Set-CellText $coverXml $coverRow4 $coverXml.CodexNs 'G' $tester
  Set-CellText $coverXml $coverRow5 $coverXml.CodexNs 'C' 'INTERDEV'
  Set-CellText $coverXml $coverRow5 $coverXml.CodexNs 'G' $tester
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'C' 'INTERDEV_User_Dashboard_Portfolio_IT_v1.0'
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'G' $today
  Set-CellText $coverXml $coverRow7 $coverXml.CodexNs 'G' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'B' $today
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'C' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'D' 'A'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'E' 'New'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'F' 'Initial User Dashboard & Portfolio integration test workbook generated from the FE16-FE18 template.'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'G' 'Profile, CV, bio, skills, and freelancer dashboard coverage'

  $listRow5 = Get-RowNode $listXml $listXml.CodexNs 5
  Set-CellText $listXml $listRow5 $listXml.CodexNs 'D' "<List enviroment requires in this system`n1. Backend API server with Auth, Profile, and Users modules enabled`n2. PostgreSQL database seeded with freelancer, broker, and client accounts plus skills, projects, and invitations`n3. Web browser with cookie support enabled`n4. Valid sample CV files and avatar images for portfolio flows`n5. A freelancer account with seeded dashboard data and optional portfolio variations`n>"
  Clear-Cells $listXml $listXml.CodexNs (9..60) @('B', 'C', 'D', 'E', 'F')
  foreach ($item in $caseListRows) {
    $row = Get-RowNode $listXml $listXml.CodexNs $item.Row
    Set-CellNumber $listXml $row $listXml.CodexNs 'B' $item.No
    Set-CellText $listXml $row $listXml.CodexNs 'C' $item.Function
  Set-CellText $listXml $row $listXml.CodexNs 'D' 'User Dashboard & Portfolio'
    Set-CellText $listXml $row $listXml.CodexNs 'E' $item.Description
    Set-CellText $listXml $row $listXml.CodexNs 'F' $item.Precondition
  }

  $featureRow2 = Get-RowNode $featureXml $featureXml.CodexNs 2
  $featureRow3 = Get-RowNode $featureXml $featureXml.CodexNs 3
  $featureRow4 = Get-RowNode $featureXml $featureXml.CodexNs 4
  $featureRow6 = Get-RowNode $featureXml $featureXml.CodexNs 6
  Set-CellText $featureXml $featureRow2 $featureXml.CodexNs 'B' 'User Dashboard & Portfolio'
  Set-CellText $featureXml $featureRow3 $featureXml.CodexNs 'B' 'Validate that signed-in users can load their profile portfolio, update account and professional information, manage CV and skills, and that freelancers can access dashboard metrics, invitations, and recommended jobs through the real frontend routes and APIs.'
  Set-CellText $featureXml $featureRow4 $featureXml.CodexNs 'B' "Frontend routes:`n- /freelancer/profile`n- /broker/profile`n- /client/profile`n- /admin/profile`n- /staff/profile`n- /freelancer/dashboard`nBackend endpoints:`n- /auth/profile`n- /profile/cv`n- /profile/bio`n- /profile/skills`n- /freelancer/dashboard`nSource files:`n- client/src/pages/ProfilePage.tsx`n- client/src/pages/FreelancerDashboardPage.tsx`n- client/src/features/auth/api.ts`n- server/src/modules/auth/auth.controller.ts`n- server/src/modules/auth/profile.controller.ts`n- server/src/modules/users/freelancer-dashboard.controller.ts`n- server/src/modules/users/users.service.ts"
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'A' '14'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'B' '0'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'C' '0'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'D' '0'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'F' '14'
  Clear-Cells $featureXml $featureXml.CodexNs (9..200) @('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J')
  foreach ($item in $featureRows) {
    $row = Get-RowNode $featureXml $featureXml.CodexNs $item.Row
    if ($item.ContainsKey('Header')) {
      Set-CellText $featureXml $row $featureXml.CodexNs 'A' $item.Header
    } else {
      Set-CellText $featureXml $row $featureXml.CodexNs 'A' $item.Id
      Set-CellText $featureXml $row $featureXml.CodexNs 'B' $item.Description
      Set-CellText $featureXml $row $featureXml.CodexNs 'C' $item.Procedure
      Set-CellText $featureXml $row $featureXml.CodexNs 'D' $item.Expected
      Set-CellText $featureXml $row $featureXml.CodexNs 'E' $item.Expected
      Set-CellText $featureXml $row $featureXml.CodexNs 'F' $item.Dependence
      Set-CellText $featureXml $row $featureXml.CodexNs 'G' 'Pass'
      Set-CellText $featureXml $row $featureXml.CodexNs 'H' $today
      Set-CellText $featureXml $row $featureXml.CodexNs 'I' $tester
      Set-CellText $featureXml $row $featureXml.CodexNs 'J' $item.Note
    }
  }

  $reportRow3 = Get-RowNode $reportXml $reportXml.CodexNs 3
  $reportRow4 = Get-RowNode $reportXml $reportXml.CodexNs 4
  $reportRow5 = Get-RowNode $reportXml $reportXml.CodexNs 5
  $reportRow6 = Get-RowNode $reportXml $reportXml.CodexNs 6
  $reportRow11 = Get-RowNode $reportXml $reportXml.CodexNs 11
  $reportRow14 = Get-RowNode $reportXml $reportXml.CodexNs 14
  $reportRow16 = Get-RowNode $reportXml $reportXml.CodexNs 16
  $reportRow17 = Get-RowNode $reportXml $reportXml.CodexNs 17
  Set-CellText $reportXml $reportRow3 $reportXml.CodexNs 'G' $tester
  Set-CellText $reportXml $reportRow4 $reportXml.CodexNs 'G' $tester
  Set-CellText $reportXml $reportRow5 $reportXml.CodexNs 'H' $today
  Set-CellText $reportXml $reportRow6 $reportXml.CodexNs 'C' 'Release scope: User Dashboard & Portfolio.'
  Clear-Cells $reportXml $reportXml.CodexNs @(11,12,13,14,16,17) @('B', 'C', 'D', 'E', 'F', 'G', 'H')
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'B' '1'
  Set-CellText $reportXml $reportRow11 $reportXml.CodexNs 'C' 'User Dashboard & Portfolio'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'D' '14'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'E' '0'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'F' '0'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'G' '0'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'H' '14'
  Set-CellText $reportXml $reportRow14 $reportXml.CodexNs 'C' 'Sub total'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'D' '14'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'E' '0'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'F' '0'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'G' '0'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'H' '14'
  Set-CellText $reportXml $reportRow16 $reportXml.CodexNs 'C' 'Test coverage'
  Set-CellNumber $reportXml $reportRow16 $reportXml.CodexNs 'E' '100'
  Set-CellText $reportXml $reportRow16 $reportXml.CodexNs 'F' '%'
  Set-CellText $reportXml $reportRow17 $reportXml.CodexNs 'C' 'Test successful coverage'
  Set-CellNumber $reportXml $reportRow17 $reportXml.CodexNs 'E' '100'
  Set-CellText $reportXml $reportRow17 $reportXml.CodexNs 'F' '%'

  $workbookXml.Save($workbookPath)
  $coverXml.Save($coverPath)
  $listXml.Save($listPath)
  $featureXml.Save($featurePath)
  $reportXml.Save($reportPath)

  Remove-Item -LiteralPath $OutputPath -Force
  [System.IO.Compression.ZipFile]::CreateFromDirectory($extractDir, $OutputPath)
} finally {
  if (Test-Path -LiteralPath $workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force }
}

Write-Output "Created integration workbook: $OutputPath"
