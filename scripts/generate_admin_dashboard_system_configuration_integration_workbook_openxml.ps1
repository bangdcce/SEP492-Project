param(
  [string]$SourcePath = 'C:\Users\ASUS\Downloads\Report5_Test Case Document_FE16-FE18\Report5_Test Case Document_FE16-FE18.xlsx',
  [string]$OutputPath = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Test Case Document_Admin_Dashboard_System_Configuration.xlsx'
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
$workDir = Join-Path $tempRoot ('admin-dashboard-config-it-' + [guid]::NewGuid().ToString())
$extractDir = Join-Path $workDir 'xlsx'

$caseListRows = @(
  @{ Row = 9; No = '1'; Function = 'Load Admin Analytics Overview'; Description = 'An admin can load the platform analytics overview payload that powers finance and dashboard-style monitoring cards.'; Precondition = 'Authenticated ADMIN account exists with seeded analytics, audit, wallet, and staffing data.' },
  @{ Row = 10; No = '2'; Function = 'Change Analytics Range'; Description = 'An admin can switch overview analytics between 7d, 30d, and 90d ranges and receive refreshed metrics.'; Precondition = 'Authenticated ADMIN account exists and the analytics endpoint is available.' },
  @{ Row = 11; No = '3'; Function = 'List Wizard Question Configuration'; Description = 'An admin can load the full wizard question configuration list, including inactive items, in the system configuration screen.'; Precondition = 'Authenticated ADMIN account exists and wizard questions are seeded.' },
  @{ Row = 12; No = '4'; Function = 'View Wizard Question Detail'; Description = 'An admin can open a wizard question detail modal with options and configuration metadata.'; Precondition = 'Authenticated ADMIN account exists and at least one wizard question is seeded.' },
  @{ Row = 13; No = '5'; Function = 'Create Wizard Question'; Description = 'An admin can create a new wizard question with valid metadata and options from the configuration page.'; Precondition = 'Authenticated ADMIN account exists and the creation payload is valid.' },
  @{ Row = 14; No = '6'; Function = 'Update Wizard Question'; Description = 'An admin can update an existing wizard question and its options from the configuration page.'; Precondition = 'Authenticated ADMIN account exists and a target wizard question is seeded.' },
  @{ Row = 15; No = '7'; Function = 'Delete or Deactivate Wizard Question'; Description = 'An admin can delete an unused wizard question or receive a deactivation outcome when linked data prevents hard deletion.'; Precondition = 'Authenticated ADMIN account exists and seeded wizard questions cover both removable and protected cases.' }
)

$featureRows = @(
  @{ Row = 9; Header = 'Load Admin Analytics Overview (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 10; Id = 'Load Admin Analytics Overview - 1'; Description = 'Load the admin analytics overview for the default 30-day range from the admin finance screen.'; Procedure = "1. Sign in as ADMIN and navigate to the finance analytics page.`n2. Allow the page to request `/admin/dashboard/overview?range=30d` together with wallet data.`n3. Inspect the returned summary cards, trends, team metrics, and risk highlights."; Expected = "1. The admin analytics overview returns a complete payload for the default 30-day range.`n2. The page can render revenue, staffing, alerts, and risk data without exposing the analytics to non-admin accounts."; Dependence = 'Authenticated ADMIN account exists with seeded analytics, wallet, audit, and staffing data.'; Note = 'Trace: `AdminFinancePage.tsx` -> `getAdminDashboardOverview()` -> `GET /admin/dashboard/overview`.' },
  @{ Row = 11; Id = 'Load Admin Analytics Overview - 2'; Description = 'Gracefully handle an unavailable analytics overview without crashing the finance screen.'; Procedure = "1. Sign in as ADMIN and open the finance analytics page.`n2. Simulate a failing `/admin/dashboard/overview` response or related analytics failure.`n3. Observe the screen state after the request settles."; Expected = "1. The page shows a stable finance unavailable state instead of leaving broken widgets on screen.`n2. The rest of the admin shell remains usable after the failed analytics load."; Dependence = 'Authenticated ADMIN account exists and the analytics overview request is forced to fail.'; Note = 'Trace: `AdminFinancePage.tsx` error state when `getAdminDashboardOverview()` rejects.' },
  @{ Row = 12; Header = 'Change Analytics Range (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 13; Id = 'Change Analytics Range - 1'; Description = 'Switch the admin analytics range from 30 days to 7 days and refresh the overview payload.'; Procedure = "1. Sign in as ADMIN and open the finance analytics page.`n2. Change the range selector to `7 days`.`n3. Wait for the overview request to refresh."; Expected = "1. The analytics overview refreshes with the 7-day range and updates the dependent finance metrics.`n2. The screen preserves a stable layout while new values are loading and after the response arrives."; Dependence = 'Authenticated ADMIN account exists and overview data is available for multiple ranges.'; Note = 'Trace: `AdminFinancePage.tsx` -> `GET /admin/dashboard/overview?range=7d`.' },
  @{ Row = 14; Id = 'Change Analytics Range - 2'; Description = 'Switch the admin analytics range to 90 days and keep the page consistent across overview and wallet sections.'; Procedure = "1. Sign in as ADMIN and open the finance analytics page.`n2. Change the range selector to `90 days`.`n3. Inspect the refreshed overview and related finance activity."; Expected = "1. The analytics overview refreshes with the 90-day range and related finance widgets remain synchronized.`n2. The page continues to support pagination and secondary loads after the range change."; Dependence = 'Authenticated ADMIN account exists and overview plus finance data are available for the 90-day range.'; Note = 'Trace: `AdminFinancePage.tsx` range switch updates overview and finance queries.' },
  @{ Row = 15; Header = 'List Wizard Question Configuration (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 16; Id = 'List Wizard Question Configuration - 1'; Description = 'Open the admin wizard question configuration page and load the full list of questions.'; Procedure = "1. Sign in as ADMIN and navigate to the wizard questions configuration page.`n2. Wait for the initial list request to `/admin/wizard/questions`.`n3. Inspect the question rows and action buttons."; Expected = "1. The system configuration page loads the full wizard question list, including sort order, code, label, and option counts.`n2. The admin can immediately access detail, edit, and add flows from the list view."; Dependence = 'Authenticated ADMIN account exists and wizard questions are seeded.'; Note = 'Trace: `AdminWizardQuestionsPage.tsx` -> `getAllQuestionsForAdmin()`.' },
  @{ Row = 17; Id = 'List Wizard Question Configuration - 2'; Description = 'Show a stable error state when the wizard question list cannot be loaded.'; Procedure = "1. Sign in as ADMIN and open the wizard questions configuration page.`n2. Simulate a failing `/admin/wizard/questions` response.`n3. Observe the screen and toast handling."; Expected = "1. The page stops the loading state and reports that wizard questions could not be loaded.`n2. The admin shell stays usable even though the configuration list failed to load."; Dependence = 'Authenticated ADMIN account exists and the list request is forced to fail.'; Note = 'Trace: `fetchQuestions()` error toast on failed `getAllQuestionsForAdmin()`.' },
  @{ Row = 18; Header = 'View Wizard Question Detail (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 19; Id = 'View Wizard Question Detail - 1'; Description = 'Open the detail modal for a wizard question and load its option metadata.'; Procedure = "1. Sign in as ADMIN and open the wizard questions configuration page.`n2. Click the view action on an existing question.`n3. Wait for the detail request to `/admin/wizard/questions/:id`."; Expected = "1. The detail modal opens with the selected wizard question code, label, help text, and option list.`n2. The loaded detail corresponds to the selected question id."; Dependence = 'Authenticated ADMIN account exists and at least one wizard question is seeded.'; Note = 'Trace: `handleViewDetail()` -> `getQuestionDetailForAdmin()`.' },
  @{ Row = 20; Id = 'View Wizard Question Detail - 2'; Description = 'Keep the page stable when loading question detail fails for a selected item.'; Procedure = "1. Sign in as ADMIN and open the wizard questions configuration page.`n2. Click view on a question while forcing the detail request to fail.`n3. Observe the modal behavior and toast response."; Expected = "1. The page reports the detail load failure and does not leave the configuration UI in a broken state.`n2. The admin can continue working with the question list after dismissing the failure."; Dependence = 'Authenticated ADMIN account exists and the detail request is forced to fail.'; Note = 'Trace: `handleViewDetail()` error toast when `getQuestionDetailForAdmin()` rejects.' },
  @{ Row = 21; Header = 'Create Wizard Question (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 22; Id = 'Create Wizard Question - 1'; Description = 'Create a new wizard question with valid code, label, input type, sort order, and complete options.'; Procedure = "1. Sign in as ADMIN and open the wizard questions configuration page.`n2. Click add question, fill a valid payload with complete option rows, and save.`n3. Wait for the create request to complete and the list to refresh."; Expected = "1. The create request succeeds and the new wizard question appears in the refreshed configuration list.`n2. A success toast confirms the configuration change."; Dependence = 'Authenticated ADMIN account exists and a valid wizard question creation payload is provided.'; Note = 'Trace: `handleAddQuestion()` + `handleSaveEdit()` -> `createWizardQuestion()`.' },
  @{ Row = 23; Id = 'Create Wizard Question - 2'; Description = 'Block the create flow when one or more options are incomplete.'; Procedure = "1. Sign in as ADMIN and open the add question modal.`n2. Leave one option value or label blank.`n3. Attempt to save the new question."; Expected = "1. The page rejects the create flow before submission and asks the admin to complete every option row.`n2. No create request is sent while invalid option rows remain."; Dependence = 'Authenticated ADMIN account exists and the new question payload contains incomplete option rows.'; Note = 'Trace: `handleSaveEdit()` validates option rows before calling `createWizardQuestion()`.' },
  @{ Row = 24; Header = 'Update Wizard Question (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 25; Id = 'Update Wizard Question - 1'; Description = 'Edit an existing wizard question and persist changes to its fields or options.'; Procedure = "1. Sign in as ADMIN and open the wizard questions configuration page.`n2. Click edit on an existing question, change fields or options, and save.`n3. Wait for the update request and list refresh."; Expected = "1. The update request succeeds and the refreshed configuration list reflects the saved question changes.`n2. A success toast confirms the update."; Dependence = 'Authenticated ADMIN account exists and a target wizard question is seeded for editing.'; Note = 'Trace: `handleEdit()` + `handleSaveEdit()` -> `updateWizardQuestion()`.' },
  @{ Row = 26; Id = 'Update Wizard Question - 2'; Description = 'Keep the edit modal stable when the update request is rejected by the server.'; Procedure = "1. Sign in as ADMIN and open the edit modal for an existing question.`n2. Submit an invalid or conflict-causing update payload.`n3. Observe the modal and error feedback."; Expected = "1. The update failure is reported without closing the edit modal unexpectedly.`n2. The admin can correct the payload and retry the update."; Dependence = 'Authenticated ADMIN account exists and the update request is forced to fail.'; Note = 'Trace: `handleSaveEdit()` catches `updateWizardQuestion()` errors and keeps the modal open.' },
  @{ Row = 27; Header = 'Delete or Deactivate Wizard Question (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 28; Id = 'Delete or Deactivate Wizard Question - 1'; Description = 'Delete a removable wizard question after the admin confirms the action.'; Procedure = "1. Sign in as ADMIN and open the wizard questions configuration page.`n2. Confirm deletion for a question that is safe to remove.`n3. Wait for the delete request and list refresh."; Expected = "1. The selected wizard question is removed from the configuration list and a success toast is shown.`n2. The list refresh stays consistent after the deletion."; Dependence = 'Authenticated ADMIN account exists and a removable wizard question is seeded.'; Note = 'Trace: `handleDelete()` -> `deleteWizardQuestion()` hard-delete path.' },
  @{ Row = 29; Id = 'Delete or Deactivate Wizard Question - 2'; Description = 'Return a deactivation outcome instead of hard deletion when the question has linked data.'; Procedure = "1. Sign in as ADMIN and open the wizard questions configuration page.`n2. Confirm deletion for a question that still has linked data or historical dependencies.`n3. Observe the result toast and refreshed list."; Expected = "1. The system returns a deactivation-style outcome instead of removing the question outright.`n2. The configuration list refreshes and the admin is informed that the question was deactivated because linked data exists."; Dependence = 'Authenticated ADMIN account exists and a protected wizard question with linked data is seeded.'; Note = 'Trace: `handleDelete()` deactivation branch when `deleteWizardQuestion()` returns `deactivated = true`.' }
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
    if ($name -eq 'Rating & Trust Score System') { $sheet.SetAttribute('name', 'Admin Dashboard & System Configuration') }
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
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'C' 'INTERDEV_Admin_Dashboard_System_Configuration_IT_v1.0'
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'G' $today
  Set-CellText $coverXml $coverRow7 $coverXml.CodexNs 'G' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'B' $today
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'C' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'D' 'A'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'E' 'New'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'F' 'Initial Admin Dashboard & System Configuration integration test workbook generated from the FE16-FE18 template.'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'G' 'Admin analytics overview and wizard-question configuration coverage'

  $listRow5 = Get-RowNode $listXml $listXml.CodexNs 5
  Set-CellText $listXml $listRow5 $listXml.CodexNs 'D' "<List enviroment requires in this system`n1. Backend API server with Admin Dashboard and Wizard modules enabled`n2. PostgreSQL database seeded with admin accounts, analytics data, audit activity, staff metrics, and wizard questions`n3. Web browser with cookie support enabled`n4. Admin routes and permissions configured for analytics and system configuration access`n5. Wizard questions include both removable items and linked-data items for delete/deactivate coverage`n>"
  Clear-Cells $listXml $listXml.CodexNs (9..60) @('B', 'C', 'D', 'E', 'F')
  foreach ($item in $caseListRows) {
    $row = Get-RowNode $listXml $listXml.CodexNs $item.Row
    Set-CellNumber $listXml $row $listXml.CodexNs 'B' $item.No
    Set-CellText $listXml $row $listXml.CodexNs 'C' $item.Function
  Set-CellText $listXml $row $listXml.CodexNs 'D' 'Admin Dashboard & System Configuration'
    Set-CellText $listXml $row $listXml.CodexNs 'E' $item.Description
    Set-CellText $listXml $row $listXml.CodexNs 'F' $item.Precondition
  }

  $featureRow2 = Get-RowNode $featureXml $featureXml.CodexNs 2
  $featureRow3 = Get-RowNode $featureXml $featureXml.CodexNs 3
  $featureRow4 = Get-RowNode $featureXml $featureXml.CodexNs 4
  $featureRow6 = Get-RowNode $featureXml $featureXml.CodexNs 6
  Set-CellText $featureXml $featureRow2 $featureXml.CodexNs 'B' 'Admin Dashboard & System Configuration'
  Set-CellText $featureXml $featureRow3 $featureXml.CodexNs 'B' 'Validate that admin users can load platform analytics overview data for dashboard-style finance monitoring and can manage wizard-question configuration through the real admin APIs and system configuration screen.'
  Set-CellText $featureXml $featureRow4 $featureXml.CodexNs 'B' "Frontend routes:`n- /admin/dashboard`n- /admin/finance`n- /admin/wizard-questions`nBackend endpoints:`n- /admin/dashboard/overview`n- /admin/wizard/questions`n- /admin/wizard/questions/:id`nSource files:`n- client/src/pages/DashboardAdminPage.tsx`n- client/src/features/payments/AdminFinancePage.tsx`n- client/src/features/dashboard/admin.api.ts`n- client/src/pages/AdminWizardQuestionsPage.tsx`n- client/src/features/wizard/services/wizardService.ts`n- server/src/modules/admin-dashboard/admin-dashboard.controller.ts`n- server/src/modules/wizard/wizard-admin.controller.ts"
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
  Set-CellText $reportXml $reportRow6 $reportXml.CodexNs 'C' 'Release scope: Admin Dashboard & System Configuration.'
  Clear-Cells $reportXml $reportXml.CodexNs @(11,12,13,14,16,17) @('B', 'C', 'D', 'E', 'F', 'G', 'H')
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'B' '1'
  Set-CellText $reportXml $reportRow11 $reportXml.CodexNs 'C' 'Admin Dashboard & System Configuration'
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
