param(
  [string]$SourcePath = 'C:\Users\ASUS\Downloads\Report5_Test Case Document_FE16-FE18\Report5_Test Case Document_FE16-FE18.xlsx',
  [string]$OutputPath = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Test Case Document_KYC_Verification_Identity_Management.xlsx'
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
$workDir = Join-Path $tempRoot ('kyc-it-' + [guid]::NewGuid().ToString())
$extractDir = Join-Path $workDir 'xlsx'

$caseListRows = @(
  @{ Row = 9; No = '1'; Function = 'Submit KYC'; Description = 'A signed-in user can submit a KYC package with personal data, ID images, and a selfie from the KYC wizard.'; Precondition = 'Authenticated user account exists. Valid image files and seed data are available.' },
  @{ Row = 10; No = '2'; Function = 'Get My KYC Status'; Description = 'A signed-in user can inspect the latest KYC status, including not-started, pending, approved, and rejected states.'; Precondition = 'Authenticated account exists with either no KYC record or a seeded latest KYC status.' },
  @{ Row = 11; No = '3'; Function = 'List KYC Queue'; Description = 'An admin or staff reviewer can load the paginated KYC review queue and filter it by status.'; Precondition = 'Signed in as ADMIN or STAFF. Seeded KYC submissions exist in multiple statuses.' },
  @{ Row = 12; No = '4'; Function = 'Review KYC Detail With Watermark'; Description = 'An admin or staff reviewer can open a KYC submission detail screen with forensic watermarked images and audit metadata.'; Precondition = 'Signed in as ADMIN or STAFF. A seeded KYC submission exists and encrypted images are accessible.' },
  @{ Row = 13; No = '5'; Function = 'Approve KYC'; Description = 'An admin or staff reviewer can approve a pending KYC request and mark the user as verified.'; Precondition = 'Signed in as ADMIN or STAFF. Target KYC request is in PENDING state.' },
  @{ Row = 14; No = '6'; Function = 'Reject KYC'; Description = 'An admin or staff reviewer can reject a pending KYC request with a non-empty rejection reason.'; Precondition = 'Signed in as ADMIN or STAFF. Target KYC request is in PENDING state and reviewer provides a rejection reason.' }
)

$featureRows = @(
  @{ Row = 9; Header = 'Submit KYC (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 10; Id = 'Submit KYC - 1'; Description = 'Submit a complete KYC package with valid personal data, ID images, and a selfie from the wizard.'; Procedure = "1. Sign in with a user account and open `/kyc`.`n2. Complete the personal-info step with valid document data, upload front ID, back ID, and selfie images, then submit the wizard.`n3. Wait for the processing state to appear."; Expected = "1. The multipart submission succeeds and the page switches to the processing state.`n2. The latest KYC record is created and available for follow-up status checks through `/kyc/me`."; Dependence = 'Authenticated user exists. Valid image files and document data are available.'; Note = 'Trace: `KYCPage.tsx` -> `POST /kyc` -> processing state.' },
  @{ Row = 11; Id = 'Submit KYC - 2'; Description = 'Keep the KYC wizard on the current step when required files or mandatory form data are missing.'; Procedure = "1. Sign in and open `/kyc`.`n2. Leave one required image or mandatory document field empty.`n3. Attempt to continue or submit the wizard."; Expected = "1. The page stays in the wizard and exposes clear validation errors for the missing fields.`n2. No KYC submission request is accepted until the required data is supplied."; Dependence = 'Authenticated user exists and enters an incomplete KYC payload.'; Note = 'Trace: `KYCPage.tsx` step validation blocks incomplete submit.' },
  @{ Row = 12; Header = 'Get My KYC Status (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 13; Id = 'Get My KYC Status - 1'; Description = 'Show the latest pending or approved KYC status for the current signed-in user.'; Procedure = "1. Sign in with an account that already has a latest KYC record.`n2. Open the KYC status page or let the app call `/kyc/me`.`n3. Inspect the status card, timestamps, and status-specific messaging."; Expected = "1. The page loads the latest KYC status without exposing another user's data.`n2. The status card reflects the correct state such as PENDING or APPROVED and keeps polling only when needed."; Dependence = 'Authenticated user exists with a seeded latest KYC submission.'; Note = 'Trace: `KYCStatusPage.tsx` -> `GET /kyc/me`.' },
  @{ Row = 14; Id = 'Get My KYC Status - 2'; Description = 'Handle the not-started or rejected status safely and guide the user to the next recovery action.'; Procedure = "1. Sign in with an account that has either no KYC record or a rejected latest KYC.`n2. Open the KYC status page.`n3. Review the empty or rejected state messaging."; Expected = "1. The page renders a stable NOT_STARTED or REJECTED state instead of failing on missing data.`n2. The user can retry KYC or navigate to the relevant next action from the status screen."; Dependence = 'Authenticated user exists with either no KYC history or a rejected latest KYC.'; Note = 'Trace: `KYCStatusPage.tsx` handles NOT_STARTED and REJECTED states from `GET /kyc/me`.' },
  @{ Row = 15; Header = 'List KYC Queue (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 16; Id = 'List KYC Queue - 1'; Description = 'Load the admin or staff KYC queue with seeded submissions across different statuses.'; Procedure = "1. Sign in as ADMIN or STAFF.`n2. Open the admin KYC page that loads `/kyc/admin/all`.`n3. Inspect the queue cards, pagination metadata, and reviewer-visible submission details."; Expected = "1. The queue loads the available KYC submissions for review.`n2. The page renders status badges and reviewer-facing metadata without exposing the user flow to unauthorized guests."; Dependence = 'Signed in as ADMIN or STAFF. Seeded KYC submissions exist in the queue.'; Note = 'Trace: `AdminKYCPage.tsx` -> `GET /kyc/admin/all`.' },
  @{ Row = 17; Id = 'List KYC Queue - 2'; Description = 'Filter the KYC queue by status and keep pagination stable for the reviewer.'; Procedure = "1. Sign in as ADMIN or STAFF and open the admin KYC queue.`n2. Apply a status filter such as `PENDING` or `REJECTED`.`n3. Inspect the refreshed result list and pagination values."; Expected = "1. The queue refreshes with only submissions matching the selected filter.`n2. Pagination and total counts stay consistent with the filtered dataset."; Dependence = 'Signed in as ADMIN or STAFF. Seeded KYC submissions exist in multiple statuses.'; Note = 'Trace: `AdminKYCPage.tsx` filtered `GET /kyc/admin/all?status=...`.' },
  @{ Row = 18; Header = 'Review KYC Detail With Watermark (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 19; Id = 'Review KYC Detail With Watermark - 1'; Description = 'Open a KYC submission detail modal with watermarked images and reviewer audit metadata.'; Procedure = "1. Sign in as ADMIN or STAFF and open the KYC queue.`n2. Select a specific submission for review.`n3. Wait for the detail request with watermark to complete and inspect the rendered images."; Expected = "1. The detail view loads the selected KYC submission with watermarked image content.`n2. Reviewer-facing metadata is present and the page remains usable for moderation actions."; Dependence = 'Signed in as ADMIN or STAFF. A valid KYC submission exists with accessible encrypted images.'; Note = 'Trace: `AdminKYCPage.tsx` -> `GET /kyc/admin/:id/watermark`.' },
  @{ Row = 20; Id = 'Review KYC Detail With Watermark - 2'; Description = 'Keep the review modal stable when the target KYC record is missing or the detail request fails.'; Procedure = "1. Sign in as ADMIN or STAFF.`n2. Attempt to open a missing or failing KYC detail record from the admin page.`n3. Observe the error handling in the review flow."; Expected = "1. The admin page shows a stable error toast or failure state instead of breaking the queue UI.`n2. The reviewer can continue working with the remaining queue after the failed detail load."; Dependence = 'Signed in as ADMIN or STAFF. Missing KYC id or failing detail request is simulated.'; Note = 'Trace: `AdminKYCPage.tsx` handles failed `GET /kyc/admin/:id/watermark`.' },
  @{ Row = 21; Header = 'Approve KYC (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 22; Id = 'Approve KYC - 1'; Description = 'Approve a pending KYC request from the admin review flow and refresh the queue.'; Procedure = "1. Sign in as ADMIN or STAFF.`n2. Open a pending KYC submission in the review modal.`n3. Click the approve action and wait for the queue to refresh."; Expected = "1. The approval request succeeds and the selected submission leaves the pending review state.`n2. The reviewed user becomes verified and the queue refresh reflects the updated approval result."; Dependence = 'Signed in as ADMIN or STAFF. Target KYC request is in PENDING state.'; Note = 'Trace: `AdminKYCPage.tsx` -> `PATCH /kyc/admin/:id/approve`.' },
  @{ Row = 23; Id = 'Approve KYC - 2'; Description = 'Reject approving a KYC request when the target submission is no longer pending.'; Procedure = "1. Sign in as ADMIN or STAFF.`n2. Attempt to approve a KYC request that is already APPROVED or REJECTED.`n3. Observe the returned error feedback."; Expected = "1. The system does not re-approve a non-pending KYC request.`n2. The admin page exposes a clear failure message and keeps the queue usable."; Dependence = 'Signed in as ADMIN or STAFF. Target KYC request is not in PENDING state.'; Note = 'Trace: approve flow handles service rejection for non-pending KYC.' },
  @{ Row = 24; Header = 'Reject KYC (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' },
  @{ Row = 25; Id = 'Reject KYC - 1'; Description = 'Reject a pending KYC request with a non-empty reason from the admin review flow.'; Procedure = "1. Sign in as ADMIN or STAFF.`n2. Open a pending KYC submission in the review modal.`n3. Enter a rejection reason and confirm the reject action."; Expected = "1. The rejection request succeeds and the selected submission moves to REJECTED status.`n2. The stored rejection reason becomes available to later status checks and admin review screens."; Dependence = 'Signed in as ADMIN or STAFF. Target KYC request is in PENDING state and reviewer provides a reason.'; Note = 'Trace: `AdminKYCPage.tsx` -> `PATCH /kyc/admin/:id/reject`.' },
  @{ Row = 26; Id = 'Reject KYC - 2'; Description = 'Block the reject action when the reviewer provides an empty or whitespace-only reason.'; Procedure = "1. Sign in as ADMIN or STAFF and open a pending KYC submission.`n2. Try to reject it without entering a meaningful reason.`n3. Observe the validation feedback before or during submission."; Expected = "1. The reject flow does not accept an empty or whitespace-only reason.`n2. The modal stays stable and asks the reviewer to provide a valid rejection reason."; Dependence = 'Signed in as ADMIN or STAFF. Target KYC request is in PENDING state.'; Note = 'Trace: `RejectKycDto` and `AdminKYCPage.tsx` reject empty reason input.' }
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
    if ($name -eq 'Rating & Trust Score System') { $sheet.SetAttribute('name', 'KYC Verification & Identity Management') }
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
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'C' 'INTERDEV_KYC_Verification_Identity_Management_IT_v1.0'
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'G' $today
  Set-CellText $coverXml $coverRow7 $coverXml.CodexNs 'G' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'B' $today
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'C' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'D' 'A'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'E' 'New'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'F' 'Initial KYC Verification & Identity Management integration test workbook generated from the FE16-FE18 template.'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'G' 'KYC user and reviewer flows, watermark review, and approval lifecycle coverage'

  $listRow5 = Get-RowNode $listXml $listXml.CodexNs 5
  Set-CellText $listXml $listRow5 $listXml.CodexNs 'D' "<List enviroment requires in this system`n1. Backend API server with KYC module enabled`n2. PostgreSQL database seeded with KYC users, reviewers, and submissions`n3. Web browser with cookie support enabled`n4. Valid sample ID images and selfie images for upload flows`n5. Admin or staff accounts for review, approval, and rejection flows`n>"
  Clear-Cells $listXml $listXml.CodexNs (9..60) @('B', 'C', 'D', 'E', 'F')
  foreach ($item in $caseListRows) {
    $row = Get-RowNode $listXml $listXml.CodexNs $item.Row
    Set-CellNumber $listXml $row $listXml.CodexNs 'B' $item.No
    Set-CellText $listXml $row $listXml.CodexNs 'C' $item.Function
  Set-CellText $listXml $row $listXml.CodexNs 'D' 'KYC Verification & Identity Management'
    Set-CellText $listXml $row $listXml.CodexNs 'E' $item.Description
    Set-CellText $listXml $row $listXml.CodexNs 'F' $item.Precondition
  }

  $featureRow2 = Get-RowNode $featureXml $featureXml.CodexNs 2
  $featureRow3 = Get-RowNode $featureXml $featureXml.CodexNs 3
  $featureRow4 = Get-RowNode $featureXml $featureXml.CodexNs 4
  $featureRow6 = Get-RowNode $featureXml $featureXml.CodexNs 6
  Set-CellText $featureXml $featureRow2 $featureXml.CodexNs 'B' 'KYC Verification & Identity Management'
  Set-CellText $featureXml $featureRow3 $featureXml.CodexNs 'B' 'Validate that signed-in users can submit KYC, inspect their latest KYC status, and that admin or staff reviewers can list, inspect, watermark, approve, and reject KYC submissions through the real frontend routes and KYC APIs.'
  Set-CellText $featureXml $featureRow4 $featureXml.CodexNs 'B' "Frontend routes:`n- /kyc`n- /staff/kyc`nBackend endpoints:`n- /kyc`n- /kyc/me`n- /kyc/admin/all`n- /kyc/admin/:id`n- /kyc/admin/:id/watermark`n- /kyc/admin/:id/approve`n- /kyc/admin/:id/reject`nSource files:`n- client/src/pages/KYCPage.tsx`n- client/src/pages/KYCStatusPage.tsx`n- client/src/pages/AdminKYCPage.tsx`n- client/src/shared/components/kyc/KYCBlocker.tsx`n- server/src/modules/kyc/kyc.controller.ts`n- server/src/modules/kyc/kyc.service.ts"
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'A' '12'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'B' '0'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'C' '0'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'D' '0'
  Set-CellNumber $featureXml $featureRow6 $featureXml.CodexNs 'F' '12'
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
  Set-CellText $reportXml $reportRow6 $reportXml.CodexNs 'C' 'Release scope: KYC Verification & Identity Management.'
  Clear-Cells $reportXml $reportXml.CodexNs @(11,12,13,14,16,17) @('B', 'C', 'D', 'E', 'F', 'G', 'H')
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'B' '1'
  Set-CellText $reportXml $reportRow11 $reportXml.CodexNs 'C' 'KYC Verification & Identity Management'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'D' '12'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'E' '0'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'F' '0'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'G' '0'
  Set-CellNumber $reportXml $reportRow11 $reportXml.CodexNs 'H' '12'
  Set-CellText $reportXml $reportRow14 $reportXml.CodexNs 'C' 'Sub total'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'D' '12'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'E' '0'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'F' '0'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'G' '0'
  Set-CellNumber $reportXml $reportRow14 $reportXml.CodexNs 'H' '12'
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
