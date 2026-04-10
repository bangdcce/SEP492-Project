param(
  [string]$WorkbookPath = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Test Case Document_Integration_Combined_v2.xlsx'
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
  foreach ($cell in $Row.SelectNodes('x:c', $Ns)) {
    if ($cell.GetAttribute('r') -eq $ref) { return $cell }
  }
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

function Get-CellStyleMap {
  param([xml]$SheetXml, [System.Xml.XmlNamespaceManager]$Ns, [int]$RowNumber, [string[]]$Columns)
  $row = Get-RowNode -SheetXml $SheetXml -Ns $Ns -RowNumber $RowNumber
  $styles = @{}
  foreach ($col in $Columns) {
    $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $row -Ns $Ns -ColumnLetters $col
    $styles[$col] = if ($cell.HasAttribute('s')) { $cell.GetAttribute('s') } else { '' }
  }
  return $styles
}

function Apply-CellStyleMap {
  param([xml]$SheetXml, [System.Xml.XmlNamespaceManager]$Ns, [int]$RowNumber, [hashtable]$StyleMap)
  $row = Get-RowNode -SheetXml $SheetXml -Ns $Ns -RowNumber $RowNumber
  foreach ($col in $StyleMap.Keys) {
    $cell = Get-OrCreateCell -SheetXml $SheetXml -Row $row -Ns $Ns -ColumnLetters $col
    if ([string]::IsNullOrWhiteSpace($StyleMap[$col])) {
      if ($cell.HasAttribute('s')) { $cell.RemoveAttribute('s') }
    } else {
      $cell.SetAttribute('s', [string]$StyleMap[$col])
    }
  }
}

function Set-FeatureSummary {
  param([xml]$SheetXml, [System.Xml.XmlNamespaceManager]$Ns, [int]$CaseCount)
  $row = Get-RowNode -SheetXml $SheetXml -Ns $Ns -RowNumber 6
  Set-CellNumber -SheetXml $SheetXml -Row $row -Ns $Ns -ColumnLetters 'A' -NumberText ([string]$CaseCount)
  Set-CellNumber -SheetXml $SheetXml -Row $row -Ns $Ns -ColumnLetters 'B' -NumberText '0'
  Set-CellNumber -SheetXml $SheetXml -Row $row -Ns $Ns -ColumnLetters 'C' -NumberText '0'
  Set-CellNumber -SheetXml $SheetXml -Row $row -Ns $Ns -ColumnLetters 'D' -NumberText '0'
  Set-CellNumber -SheetXml $SheetXml -Row $row -Ns $Ns -ColumnLetters 'F' -NumberText ([string]$CaseCount)
}

function Get-EstimatedLineCount {
  param([string]$Text, [int]$CharsPerLine)

  if ([string]::IsNullOrEmpty($Text)) { return 1 }

  $total = 0
  foreach ($part in ($Text -split "`n")) {
    $length = if ([string]::IsNullOrEmpty($part)) { 0 } else { $part.Length }
    $wrapped = [Math]::Ceiling(([double][Math]::Max($length, 1)) / [double]$CharsPerLine)
    $total += [Math]::Max([int]$wrapped, 1)
  }

  return [Math]::Max($total, 1)
}

function Set-RowHeightForCase {
  param(
    [System.Xml.XmlElement]$Row,
    [string]$IdText,
    [string]$DescriptionText,
    [string]$ProcedureText,
    [string]$ExpectedText,
    [string]$DependenceText,
    [string]$NoteText
  )

  $maxLines = @(
    (Get-EstimatedLineCount -Text $IdText -CharsPerLine 18),
    (Get-EstimatedLineCount -Text $DescriptionText -CharsPerLine 18),
    (Get-EstimatedLineCount -Text $ProcedureText -CharsPerLine 24),
    (Get-EstimatedLineCount -Text $ExpectedText -CharsPerLine 34),
    (Get-EstimatedLineCount -Text $DependenceText -CharsPerLine 22),
    (Get-EstimatedLineCount -Text $NoteText -CharsPerLine 24)
  ) | Measure-Object -Maximum | Select-Object -ExpandProperty Maximum

  $height = [Math]::Max(42, (18 * [int]$maxLines) + 10)
  $Row.SetAttribute('ht', ([string]$height))
  $Row.SetAttribute('customHeight', '1')
}

function Set-RowHeightFixed {
  param(
    [System.Xml.XmlElement]$Row,
    [int]$Height
  )

  $Row.SetAttribute('ht', ([string]$Height))
  $Row.SetAttribute('customHeight', '1')
}

function Format-InputSegment {
  param([string]$Segment)

  $text = $Segment.Trim().TrimEnd('.')
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }

  $text = $text -replace '^(enter|Enter)\s+email\s+', 'Enter email: '
  $text = $text -replace '^(enter|Enter)\s+OTP\s+', 'Enter OTP: '
  $text = $text -replace '^password\s+', 'Password: '
  $text = $text -replace '^full name\s+', 'Full name: '
  $text = $text -replace '^phone\s+', 'Phone: '
  $text = $text -replace '^select role\s+', 'Select role: '
  $text = $text -replace '^choose domain\s+', 'Choose domain: '
  $text = $text -replace '^choose skills\s+', 'Choose skills: '
  $text = $text -replace '^enter code\s+', 'Enter code: '
  $text = $text -replace '^enter label\s+', 'Enter label: '
  $text = $text -replace '^help text\s+', 'Help text: '
  $text = $text -replace '^options\s+', 'Options: '
  $text = $text -replace '^select date range\s+', 'Select date range: '
  $text = $text -replace '^trigger an overview request with unsupported range value\s+', 'Range value: '
  $text = $text -replace '^remove option\s+', 'Remove option: '
  $text = $text -replace '^change the label to\s+', 'Change label to: '
  $text = $text -replace '^change option label\s+', 'Change option label: '
  $text = $text -replace '^option value\s+', 'Option value: '
  $text = $text -replace '^tick\s+', 'Tick: '

  return ('- ' + $text)
}

function Convert-ToInputDataBlock {
  param([string]$Line)

  if ([string]::IsNullOrWhiteSpace($Line)) { return $Line }

  if (-not $Line.Contains(', ')) {
    return $Line
  }

  $prefixMatch = [regex]::Match($Line, '^\d+\.\s*')
  $prefix = ''
  $body = $Line
  if ($prefixMatch.Success) {
    $prefix = $prefixMatch.Value
    $body = $Line.Substring($prefix.Length)
  }

  $normalizedBody = $body.Trim()
  $normalizedBody = $normalizedBody -replace '\sand enter\s', ', enter '
  $normalizedBody = $normalizedBody -replace ', and ', ', '
  $normalizedBody = $normalizedBody -replace '\sand add one option\s', ', add one option '

  $looksLikeInputData =
    $normalizedBody -match '(role|email|password|full name|phone|domain|skills|Terms and Privacy|CAPTCHA|OTP|code |label|help text|option|date range)'

  if (-not $looksLikeInputData) {
    return $Line
  }

  $parts = $normalizedBody -split ',\s+'
  if ($parts.Count -le 1) {
    return $Line
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add($prefix + 'Input data:')
  foreach ($part in $parts) {
    $formatted = Format-InputSegment -Segment $part
    if ($null -ne $formatted) {
      $lines.Add($formatted)
    }
  }

  return ($lines -join "`n")
}

function Normalize-UserVisibleText {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }

  $normalized = $Text
  $normalized = $normalized -replace '\s+and timezone to ''[^'']+''', ''
  $normalized = $normalized -replace 'timezone to ''[^'']+'',?\s*', ''
  $normalized = $normalized -replace 'Keep full name, phone number, and timezone unchanged, but', 'Keep full name and phone number unchanged, then'
  $normalized = $normalized -replace 'full name, phone number, and timezone', 'full name and phone number'
  $normalized = $normalized -replace 'timezone ''[^'']+''', 'the current time setting'

  $normalized = $normalized -replace 'authenticated session', 'signed-in state'
  $normalized = $normalized -replace 'authentication cookies', 'sign-in state'
  $normalized = $normalized -replace 'current authentication cookies', 'current sign-in state'
  $normalized = $normalized -replace 'refresh cookie', 'remembered sign-in state'
  $normalized = $normalized -replace 'refresh token cookie', 'remembered sign-in state'
  $normalized = $normalized -replace 'access token', 'current sign-in'
  $normalized = $normalized -replace 'bootstrap the session automatically', 'finish loading the signed-in account'
  $normalized = $normalized -replace 'Session bootstrap loads the authenticated user profile and keeps the protected page mounted', 'The dashboard finishes loading and stays open for the signed-in user'
  $normalized = $normalized -replace 'no authenticated session is created', 'the user is not signed in'
  $normalized = $normalized -replace 'session remains active', 'user stays signed in'
  $normalized = $normalized -replace 'session has been revoked', 'user has been signed out'
  $normalized = $normalized -replace 'browser session', 'browser sign-in state'
  $normalized = $normalized -replace 'refresh session', 'remembered sign-in state'

  $normalized = $normalized -replace 'token query parameter', 'verification link'
  $normalized = $normalized -replace 'signed download URL', 'download link'
  $normalized = $normalized -replace 'public CV URL', 'CV link'
  $normalized = $normalized -replace 'storage-backed CV', 'stored CV file'
  $normalized = $normalized -replace 'storage provider', 'file service'
  $normalized = $normalized -replace 'storage signer', 'download service'
  $normalized = $normalized -replace 'backend', 'system'
  $normalized = $normalized -replace 'payload', 'result'
  $normalized = $normalized -replace 'skillIds', 'skill list'
  $normalized = $normalized -replace 'range query', 'range filter'
  $normalized = $normalized -replace 'query parameter', 'link value'
  $normalized = $normalized -replace 'emailVerifiedAt set', 'email already verified'
  $normalized = $normalized -replace 'status Deleted', 'already deleted'
  $normalized = $normalized -replace 'master skills catalog', 'available skills list'

  $normalized = $normalized -replace '\s{2,}', ' '
  $normalized = $normalized -replace '\s+,', ','
  $normalized = $normalized -replace '\s+\.', '.'
  return $normalized.Trim()
}

function Normalize-ProcedureText {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }

  $lines = @()
  foreach ($rawLine in ($Text -split "`n")) {
    $line = $rawLine.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $normalized = ($line -replace '^\d+\.\s*', '').Trim()
    $normalized = Normalize-UserVisibleText -Text $normalized
    $isLoadingNoise =
      $normalized -match '^(Wait for .*(load|loading|reload|refresh)|Observe the loading state.*)$' -or
      $normalized -match '^(Wait for the page to finish loading\.?|Wait for the page to load\.?)$' -or
      $normalized -match '^(Wait for the profile to refresh.*)$' -or
      $normalized -match '^(Wait for the overview widgets to refresh.*)$' -or
      $normalized -match '^(Wait for the queue data to load\.?)$' -or
      $normalized -match '^(Wait for the detail modal to load\.?)$' -or
      $normalized -match '^(Wait for the configuration table to load\.?)$' -or
      $normalized -match '^(Wait for the summary cards and work widgets to finish loading\.?)$'

    if (-not $isLoadingNoise) {
      $lines += (Convert-ToInputDataBlock -Line $normalized)
    }
  }

  $renumbered = @()
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $renumbered += ('{0}. {1}' -f ($i + 1), $lines[$i])
  }

  return ($renumbered -join "`n")
}

function Normalize-DependenceText {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }

  $normalized = $Text.Trim()
  $normalized = $normalized -replace '\.\s+', ".`n"

  $segments = New-Object System.Collections.Generic.List[string]
  foreach ($line in ($normalized -split "`n")) {
    $trimmedLine = $line.Trim().TrimEnd('.')
    if ([string]::IsNullOrWhiteSpace($trimmedLine)) { continue }

    if ($trimmedLine -match ' and ' -and $trimmedLine -notmatch 'between .+ and .+') {
      foreach ($part in ($trimmedLine -split '\s+and\s+')) {
        $partText = $part.Trim().TrimEnd('.')
        if (-not [string]::IsNullOrWhiteSpace($partText)) {
          $segments.Add('- ' + $partText + '.')
        }
      }
    }
    else {
      $segments.Add('- ' + $trimmedLine + '.')
    }
  }

  return ($segments -join "`n")
}

function New-Case {
  param(
    [string]$Id,
    [string]$Description,
    [string]$Procedure,
    [string]$Expected,
    [string]$Dependence,
    [string]$Note
  )

  return [pscustomobject]@{
    Id          = $Id
    Description = $Description
    Procedure   = $Procedure
    Expected    = $Expected
    Dependence  = $Dependence
    Note        = $Note
  }
}

function New-Section {
  param([string]$Header, [object[]]$Cases)
  return [pscustomobject]@{
    Header = $Header
    Cases  = $Cases
  }
}

function Write-FeatureSheet {
  param([string]$SheetPath, [object[]]$Sections, [string]$Tester, [string]$Today)

  [xml]$sheetXml = Read-XmlFile $SheetPath
  $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
  $ns.AddNamespace('x', $sheetXml.DocumentElement.NamespaceURI)

  $cols = @('A','B','C','D','E','F','G','H','I','J')
  $headerStyles = Get-CellStyleMap -SheetXml $sheetXml -Ns $ns -RowNumber 9 -Columns $cols
  $caseStyles = Get-CellStyleMap -SheetXml $sheetXml -Ns $ns -RowNumber 10 -Columns $cols

  Clear-Cells -SheetXml $sheetXml -Ns $ns -Rows (9..70) -Columns $cols

  $currentRow = 9
  $caseCount = 0
  foreach ($section in $Sections) {
    Apply-CellStyleMap -SheetXml $sheetXml -Ns $ns -RowNumber $currentRow -StyleMap $headerStyles
    $row = Get-RowNode -SheetXml $sheetXml -Ns $ns -RowNumber $currentRow
    Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'A' -Text $section.Header
    Set-RowHeightFixed -Row $row -Height 28
    $currentRow++

    foreach ($case in $section.Cases) {
      Apply-CellStyleMap -SheetXml $sheetXml -Ns $ns -RowNumber $currentRow -StyleMap $caseStyles
      $row = Get-RowNode -SheetXml $sheetXml -Ns $ns -RowNumber $currentRow
      $descriptionText = Normalize-UserVisibleText -Text $case.Description
      $procedureText = Normalize-ProcedureText -Text $case.Procedure
      $expectedText = Normalize-UserVisibleText -Text $case.Expected
      $dependenceText = Normalize-DependenceText -Text (Normalize-UserVisibleText -Text $case.Dependence)
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'A' -Text $case.Id
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'B' -Text $descriptionText
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'C' -Text $procedureText
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'D' -Text $expectedText
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'E' -Text $expectedText
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'F' -Text $dependenceText
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'G' -Text 'Pass'
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'H' -Text $Today
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'I' -Text $Tester
      Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'J' -Text $case.Note
      Set-RowHeightForCase -Row $row -IdText $case.Id -DescriptionText $descriptionText -ProcedureText $procedureText -ExpectedText $expectedText -DependenceText $dependenceText -NoteText $case.Note
      $currentRow++
      $caseCount++
    }
  }

  Set-FeatureSummary -SheetXml $sheetXml -Ns $ns -CaseCount $caseCount
  $sheetXml.Save($SheetPath)
  return $caseCount
}

function Update-TestCaseList {
  param([string]$SheetPath)
  [xml]$sheetXml = Read-XmlFile $SheetPath
  $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
  $ns.AddNamespace('x', $sheetXml.DocumentElement.NamespaceURI)
  $row = Get-RowNode -SheetXml $sheetXml -Ns $ns -RowNumber 32
  Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'C' -Text 'Create Wizard Question'
  Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'E' -Text 'Admin opens the wizard-question management flow, creates a new question with valid code, label, and options, and sees the new record returned in the configuration list.'
  Set-CellText -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'F' -Text 'Authenticated admin account is available and the wizard-question configuration service is reachable.'
  Clear-Cells -SheetXml $sheetXml -Ns $ns -Rows @(34) -Columns @('B','C','D','E','F')
  $sheetXml.Save($SheetPath)
}

function Update-TestReport {
  param([string]$SheetPath, [int]$AuthCount, [int]$KycCount, [int]$UserCount, [int]$AdminCount)

  [xml]$sheetXml = Read-XmlFile $SheetPath
  $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
  $ns.AddNamespace('x', $sheetXml.DocumentElement.NamespaceURI)
  $total = $AuthCount + $KycCount + $UserCount + $AdminCount

  $rows = @{
    11 = $AuthCount
    12 = $KycCount
    13 = $UserCount
    14 = $AdminCount
  }

  foreach ($rowNumber in $rows.Keys) {
    $row = Get-RowNode -SheetXml $sheetXml -Ns $ns -RowNumber $rowNumber
    $count = [string]$rows[$rowNumber]
    Set-CellNumber -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'D' -NumberText $count
    Set-CellNumber -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'E' -NumberText '0'
    Set-CellNumber -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'F' -NumberText '0'
    Set-CellNumber -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'G' -NumberText '0'
    Set-CellNumber -SheetXml $sheetXml -Row $row -Ns $ns -ColumnLetters 'H' -NumberText $count
  }

  $subtotalRow = Get-RowNode -SheetXml $sheetXml -Ns $ns -RowNumber 15
  Set-CellNumber -SheetXml $sheetXml -Row $subtotalRow -Ns $ns -ColumnLetters 'D' -NumberText ([string]$total)
  Set-CellNumber -SheetXml $sheetXml -Row $subtotalRow -Ns $ns -ColumnLetters 'E' -NumberText '0'
  Set-CellNumber -SheetXml $sheetXml -Row $subtotalRow -Ns $ns -ColumnLetters 'F' -NumberText '0'
  Set-CellNumber -SheetXml $sheetXml -Row $subtotalRow -Ns $ns -ColumnLetters 'G' -NumberText '0'
  Set-CellNumber -SheetXml $sheetXml -Row $subtotalRow -Ns $ns -ColumnLetters 'H' -NumberText ([string]$total)

  $sheetXml.Save($SheetPath)
}

$tester = 'BaoNG'
$today = Get-Date -Format 'yyyy-MM-dd'
$tempRoot = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets'
$workDir = Join-Path $tempRoot ('upgrade-int-' + [guid]::NewGuid().ToString())
$extractDir = Join-Path $workDir 'xlsx'

$authSections = @(
  (New-Section -Header 'Register Account (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Register Account - 1' -Description 'Register a new freelancer account with valid identity data, selected domains, selected skills, legal consent, and CAPTCHA.' -Procedure "1. Open the Register page as a guest user.`n2. Select role Freelancer and enter email 'bao.freelancer.it01@gmail.com', password 'StrongPass@123', full name 'Nguyen Gia Bao', phone '0987654321', choose domain 'Web Development', choose skills 'ReactJS' and 'TypeScript', tick Terms and Privacy, and complete CAPTCHA.`n3. Click Create Account and wait for the verification-pending screen." -Expected "1. The registration request succeeds and the screen changes to Email verification pending for 'bao.freelancer.it01@gmail.com'.`n2. The new freelancer account is created with the selected domain and skills saved for later onboarding." -Dependence 'Guest user is not signed in. CAPTCHA and reference data for domains and skills are available.' -Note 'Trace: SignUpPage -> POST /auth/register -> verify-email pending state.')
    (New-Case -Id 'Register Account - 2' -Description 'Register a new client account with valid data and without broker/freelancer-specific skill selection.' -Procedure "1. Open the Register page as a guest user.`n2. Select role Client and enter email 'lan.client.it02@gmail.com', password 'ClientPass@123', full name 'Tran Thi Lan', phone '0912345678', tick Terms and Privacy, and complete CAPTCHA.`n3. Click Create Account and observe the post-submit result." -Expected "1. The registration request succeeds and the screen changes to Email verification pending for 'lan.client.it02@gmail.com'.`n2. The new client account is created without requiring domain or skill selection." -Dependence 'Guest user is not signed in. CAPTCHA is enabled and the email address has not been used before.' -Note 'Trace: SignUpPage -> POST /auth/register for Client role.')
    (New-Case -Id 'Register Account - 3' -Description 'Reject registration when the submitted email address already belongs to an existing account.' -Procedure "1. Open the Register page as a guest user.`n2. Select role Freelancer and enter email 'verified.user@gmail.com', password 'StrongPass@123', full name 'Nguyen Gia Bao', phone '0987654321', tick Terms and Privacy, and complete CAPTCHA.`n3. Click Create Account and read the feedback message on the same page." -Expected "1. The Register page stays open and shows a duplicate-email validation error for 'verified.user@gmail.com'.`n2. No new account is created and no authenticated session is started." -Dependence 'The email address verified.user@gmail.com already exists in the system.' -Note 'Trace: SignUpPage handles duplicate-email response from POST /auth/register.')
    (New-Case -Id 'Register Account - 4' -Description 'Reject registration when the user does not accept Terms and Privacy before submitting the form.' -Procedure "1. Open the Register page as a guest user.`n2. Select role Freelancer and enter email 'missing.consent.it04@gmail.com', password 'StrongPass@123', full name 'Nguyen Gia Bao', phone '0987654321', complete CAPTCHA, but leave Terms and Privacy unchecked.`n3. Click Create Account and read the validation feedback." -Expected "1. The Register page blocks submission because Terms and Privacy consent is required.`n2. No account is created for 'missing.consent.it04@gmail.com'." -Dependence 'Guest user is not signed in and legal-consent validation is active on the registration flow.' -Note 'Trace: SignUpPage consent validation before or during POST /auth/register.')
    (New-Case -Id 'Register Account - 5' -Description 'Register a new broker account with valid broker role data and selected domains and skills.' -Procedure "1. Open the Register page as a guest user.`n2. Select role Broker and enter email 'bao.broker.it05@gmail.com', password 'BrokerPass@123', full name 'Bao Nguyen Broker', phone '0977001122', choose domain 'Business Analysis', choose skills 'Project Discovery' and 'Solution Consulting', tick Terms and Privacy, and complete CAPTCHA.`n3. Click Create Account and wait for the verification-pending screen." -Expected "1. The registration request succeeds and the screen changes to Email verification pending for 'bao.broker.it05@gmail.com'.`n2. The new broker account is created with the selected domains and skills saved successfully." -Dependence 'Guest user is not signed in. Broker role is enabled for self-registration and reference data is available.' -Note 'Trace: SignUpPage -> POST /auth/register for Broker role.')
    (New-Case -Id 'Register Account - 6' -Description 'Reject registration when the password does not satisfy the required strength rules.' -Procedure "1. Open the Register page as a guest user.`n2. Select role Client and enter email 'weak.password.it06@gmail.com', password '123456', full name 'Tran Thi Weak', phone '0911223344', tick Terms and Privacy, and complete CAPTCHA.`n3. Click Create Account and observe the validation feedback." -Expected "1. The Register page blocks submission because password '123456' does not satisfy the required strength policy.`n2. No account is created for 'weak.password.it06@gmail.com'." -Dependence 'Password-strength validation is active on the registration form or backend endpoint.' -Note 'Trace: SignUpPage validation for weak password.')
  ))
  (New-Section -Header 'Verify Email (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Verify Email - 1' -Description 'Verify a newly created account with a valid verification token from the email message.' -Procedure "1. Open the Verify Email page from the verification link sent to 'bao.freelancer.it01@gmail.com'.`n2. Keep the valid token in the link and wait for the page to finish loading.`n3. Review the success state and the next navigation action." -Expected "1. The Verify Email page shows a success message for the submitted account.`n2. The account for 'bao.freelancer.it01@gmail.com' becomes email verified and can continue to the Sign In page." -Dependence 'An unverified account exists and still has a valid verification token.' -Note 'Trace: VerifyEmailPage -> GET /auth/verify-email success path.')
    (New-Case -Id 'Verify Email - 2' -Description 'Show a stable expired-token state and let the user request another verification email.' -Procedure "1. Open the Verify Email page with an expired token for 'expired.user@gmail.com'.`n2. Wait for the page to display the failed verification state.`n3. Click Resend verification email for 'expired.user@gmail.com'." -Expected "1. The Verify Email page shows an expired or invalid token message instead of crashing.`n2. The resend-verification action succeeds and a new verification email is sent to 'expired.user@gmail.com'." -Dependence 'An unverified account exists for expired.user@gmail.com and the current token is expired.' -Note 'Trace: VerifyEmailPage -> failed verify -> POST /auth/resend-verification.')
    (New-Case -Id 'Verify Email - 3' -Description 'Keep the page stable when the verification token is missing from the link.' -Procedure "1. Open the Verify Email page without a token query parameter.`n2. Wait for the page to evaluate the request state.`n3. Review the visible recovery actions." -Expected "1. The Verify Email page shows a token-missing or invalid-link state instead of a blank screen.`n2. The user stays on the verification recovery flow and can go back to Sign In or request a new verification email." -Dependence 'The verification page is reachable even when no token query parameter is supplied.' -Note 'Trace: VerifyEmailPage handles missing-token scenario.')
    (New-Case -Id 'Verify Email - 4' -Description 'Reject the verification attempt when the account has already been verified previously.' -Procedure "1. Open the Verify Email page using a token or link associated with already verified account 'verified.user@gmail.com'.`n2. Wait for the page to load the verification result.`n3. Review the returned state and available actions." -Expected "1. The Verify Email page shows that email is already verified instead of attempting another successful verification.`n2. The user can continue to Sign In without changing the existing verified state." -Dependence 'The account verified.user@gmail.com already has emailVerifiedAt set before the page is opened.' -Note 'Trace: GET /auth/verify-email already-verified path.')
    (New-Case -Id 'Verify Email - 5' -Description 'Reject the verification attempt when the target account has already been deleted.' -Procedure "1. Open the Verify Email page with a token linked to deleted account 'deleted.verify.user@gmail.com'.`n2. Wait for the page to load the verification result.`n3. Review the returned state and recovery actions." -Expected "1. The Verify Email page shows that the account has been deleted and the verification cannot continue.`n2. The page does not switch to a success state for the deleted account." -Dependence 'The token still maps to a user record whose status is already Deleted.' -Note 'Trace: GET /auth/verify-email deleted-account path.')
    (New-Case -Id 'Verify Email - 6' -Description 'Reject resend verification when the email address is already verified.' -Procedure "1. Open the Verify Email recovery flow for account 'verified.user@gmail.com'.`n2. Click Resend verification email for 'verified.user@gmail.com'.`n3. Review the returned feedback on the page." -Expected "1. The resend-verification request is rejected because 'verified.user@gmail.com' is already verified.`n2. No new verification email is sent for the already verified account." -Dependence 'The account verified.user@gmail.com already has emailVerifiedAt set.' -Note 'Trace: POST /auth/resend-verification already-verified path.')
  ))
  (New-Section -Header 'Login & Session Bootstrap (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Login & Session Bootstrap - 1' -Description 'Sign in a verified freelancer account and bootstrap the authenticated session successfully.' -Procedure "1. Open the Sign In page.`n2. Enter email 'verified.user@gmail.com' and password 'StrongPass@123', then click Sign In.`n3. Wait for the role dashboard to open and let the app bootstrap the session automatically." -Expected "1. Sign In succeeds, authentication cookies are created, and the user is redirected to the correct dashboard.`n2. Session bootstrap loads the authenticated user profile and keeps the protected page mounted." -Dependence 'The account verified.user@gmail.com exists, is email verified, and has password StrongPass@123.' -Note 'Trace: SignInPage -> POST /auth/login -> GET /auth/session.')
    (New-Case -Id 'Login & Session Bootstrap - 2' -Description 'Reject login when the password is wrong for an existing verified account.' -Procedure "1. Open the Sign In page.`n2. Enter email 'verified.user@gmail.com' and password 'WrongPass@123', then click Sign In.`n3. Observe the error message and the current route." -Expected "1. Sign In fails with an invalid-credentials message for 'verified.user@gmail.com'.`n2. The user remains on the Sign In page and no authenticated session is created." -Dependence 'The account verified.user@gmail.com exists and the password WrongPass@123 is invalid.' -Note 'Trace: SignInPage handles failed POST /auth/login response.')
    (New-Case -Id 'Login & Session Bootstrap - 3' -Description 'Block login for an unverified account and redirect the user into the email-verification recovery flow.' -Procedure "1. Open the Sign In page.`n2. Enter email 'unverified.user@gmail.com' and password 'StrongPass@123', then click Sign In.`n3. Review the screen state after the backend rejects the sign-in." -Expected "1. Sign In does not create an authenticated session for 'unverified.user@gmail.com'.`n2. The UI opens the verification recovery path so the user can verify email before trying to sign in again." -Dependence 'The account unverified.user@gmail.com exists with a valid password but emailVerifiedAt is still empty.' -Note 'Trace: SignInPage handles EMAIL_NOT_VERIFIED response.')
    (New-Case -Id 'Login & Session Bootstrap - 4' -Description 'Reject login when the submitted email address does not belong to any existing account.' -Procedure "1. Open the Sign In page.`n2. Enter email 'notfound.user@gmail.com' and password 'StrongPass@123', then click Sign In.`n3. Review the returned feedback on the page." -Expected "1. Sign In fails because 'notfound.user@gmail.com' does not exist in the system.`n2. The user remains on the Sign In page and no authenticated session is created." -Dependence 'The email address notfound.user@gmail.com does not exist in the current authentication database.' -Note 'Trace: SignInPage handles account-not-found response from POST /auth/login.')
    (New-Case -Id 'Login & Session Bootstrap - 5' -Description 'Reject login when the account has already been banned by an administrator.' -Procedure "1. Open the Sign In page.`n2. Enter email 'banned.user@gmail.com' and password 'StrongPass@123', then click Sign In.`n3. Review the returned feedback on the page." -Expected "1. Sign In fails because account 'banned.user@gmail.com' is banned.`n2. The user remains on the Sign In page and no authenticated session is created." -Dependence 'The account banned.user@gmail.com exists and is marked as banned before the login attempt.' -Note 'Trace: POST /auth/login banned-account path.')
    (New-Case -Id 'Login & Session Bootstrap - 6' -Description 'Reject login when the account has already been deleted.' -Procedure "1. Open the Sign In page.`n2. Enter email 'deleted.user@gmail.com' and password 'StrongPass@123', then click Sign In.`n3. Review the returned feedback on the page." -Expected "1. Sign In fails because account 'deleted.user@gmail.com' has been deleted.`n2. The user remains on the Sign In page and no authenticated session is created." -Dependence 'The account deleted.user@gmail.com exists with status Deleted before the login attempt.' -Note 'Trace: POST /auth/login deleted-account path.')
  ))
  (New-Section -Header 'Refresh and Logout (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Refresh and Logout - 1' -Description 'Refresh the access token silently for an already authenticated user with a valid refresh cookie.' -Procedure "1. Start from an authenticated browser session for 'verified.user@gmail.com'.`n2. Let the app call the refresh flow while opening a protected page after the access token expires.`n3. Continue using the page after refresh completes." -Expected "1. The refresh flow issues a new access token without sending the user back to the Sign In page.`n2. The protected page stays visible and the authenticated session remains active." -Dependence 'The current browser session contains a valid refresh token cookie.' -Note 'Trace: shared/api/client silent refresh -> POST /auth/refresh.')
    (New-Case -Id 'Refresh and Logout - 2' -Description 'Log out the current account and force the next protected-page request back to Sign In.' -Procedure "1. Start from an authenticated browser session for 'verified.user@gmail.com'.`n2. Click Log out from the authenticated header menu.`n3. Try to open the Profile page again after logout finishes." -Expected "1. Log out succeeds and the current authentication cookies are cleared.`n2. The next protected-page check redirects the user to Sign In because the session has been revoked." -Dependence 'The current browser session contains active authentication cookies.' -Note 'Trace: Header logout -> POST /auth/logout -> protected-route redirect.')
    (New-Case -Id 'Refresh and Logout - 3' -Description 'Reject refresh when the refresh cookie is missing or revoked and send the user back to Sign In.' -Procedure "1. Open a protected page with an expired access token and without a valid refresh cookie.`n2. Let the app attempt the refresh flow automatically.`n3. Observe the final navigation result." -Expected "1. The refresh request fails because there is no valid refresh session to continue.`n2. The app clears local auth state and redirects the user back to Sign In." -Dependence 'The browser either has no refresh token cookie or the refresh token has already been revoked.' -Note 'Trace: POST /auth/refresh failure -> frontend recovery to Sign In.')
    (New-Case -Id 'Refresh and Logout - 4' -Description 'Allow logout to finish safely even when the current browser no longer has a refresh cookie.' -Procedure "1. Start from a browser state where local authenticated UI is still open but the refresh cookie has already been removed.`n2. Click Log out from the header menu.`n3. Observe the final navigation result." -Expected "1. The logout flow still completes safely and clears any remaining client-side auth state.`n2. The user is redirected to Sign In even though no refresh cookie was present at the moment of logout." -Dependence 'The browser session has no current refresh cookie but the user can still trigger the logout action from the UI.' -Note 'Trace: POST /auth/logout fallback path without refresh cookie.')
    (New-Case -Id 'Refresh and Logout - 5' -Description 'Reject refresh when the presented refresh session has already been revoked.' -Procedure "1. Open a protected page with an expired access token and a refresh cookie that belongs to revoked session 'revoked-session-001'.`n2. Let the app attempt the refresh flow automatically.`n3. Observe the final navigation result." -Expected "1. The refresh request fails because refresh session 'revoked-session-001' is already revoked.`n2. The app redirects the user back to Sign In and the protected page is not kept open." -Dependence 'The browser contains a revoked refresh cookie that still triggers the refresh attempt.' -Note 'Trace: POST /auth/refresh revoked-session path.')
    (New-Case -Id 'Refresh and Logout - 6' -Description 'Reject refresh when the refresh token has already expired.' -Procedure "1. Open a protected page with an expired access token and an expired refresh cookie 'expired-refresh-001'.`n2. Let the app attempt the refresh flow automatically.`n3. Observe the final navigation result." -Expected "1. The refresh request fails because the refresh token has already expired.`n2. The app redirects the user back to Sign In and the expired session cannot continue." -Dependence 'The browser contains an expired refresh cookie that still triggers the refresh attempt.' -Note 'Trace: POST /auth/refresh expired-session path.')
  ))
  (New-Section -Header 'Password Recovery (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Password Recovery - 1' -Description 'Request a password-reset OTP for an existing account and move to the OTP verification step.' -Procedure "1. Open the Forgot Password page.`n2. Enter email 'recover.user@gmail.com' and click Send OTP.`n3. Wait for the page to move to the OTP verification step." -Expected "1. The Forgot Password flow accepts 'recover.user@gmail.com' and advances to the OTP verification step.`n2. A reset OTP is generated and sent to the registered inbox for recover.user@gmail.com." -Dependence 'The account recover.user@gmail.com exists and can receive email or seeded OTP test data.' -Note 'Trace: ForgotPasswordPage -> POST /auth/forgot-password.')
    (New-Case -Id 'Password Recovery - 2' -Description 'Keep the flow blocked when the user enters a wrong OTP value.' -Procedure "1. Open the OTP verification step for 'recover.user@gmail.com'.`n2. Enter OTP '111111' and click Verify OTP.`n3. Review the page state after verification fails." -Expected "1. OTP verification fails for value '111111' and the page shows a clear invalid-OTP message.`n2. The reset-password step does not open until the user enters a valid OTP." -Dependence 'The password-recovery flow is already at the OTP step for recover.user@gmail.com, and 111111 is not the active OTP.' -Note 'Trace: ForgotPasswordPage -> POST /auth/verify-otp negative path.')
    (New-Case -Id 'Password Recovery - 3' -Description 'Reset the password with a valid OTP and sign in with the new password afterward.' -Procedure "1. Open the reset-password step for 'recover.user@gmail.com' after a valid OTP '246810' has been verified.`n2. Enter new password 'ResetPass@123' and confirm password 'ResetPass@123', then submit the reset form.`n3. Return to Sign In and log in with email 'recover.user@gmail.com' and password 'ResetPass@123'." -Expected "1. The password-reset request succeeds and stores 'ResetPass@123' as the new active password for recover.user@gmail.com.`n2. The user can sign in successfully with the new password immediately after reset completes." -Dependence 'OTP 246810 has already been verified for recover.user@gmail.com and the reset-password step is unlocked.' -Note 'Trace: POST /auth/reset-password -> Sign In with new credential.')
    (New-Case -Id 'Password Recovery - 4' -Description 'Reject the forgot-password request when the submitted email address does not exist in the system.' -Procedure "1. Open the Forgot Password page.`n2. Enter email 'missing.reset.user@gmail.com' and click Send OTP.`n3. Review the returned feedback on the page." -Expected "1. The forgot-password request is rejected because 'missing.reset.user@gmail.com' does not exist.`n2. The flow does not advance to the OTP step for a missing account." -Dependence 'The email address missing.reset.user@gmail.com does not exist in the authentication database.' -Note 'Trace: ForgotPasswordPage handles account-not-found response from POST /auth/forgot-password.')
    (New-Case -Id 'Password Recovery - 5' -Description 'Reject OTP verification when the submitted OTP has already expired.' -Procedure "1. Open the OTP verification step for 'recover.user@gmail.com'.`n2. Enter expired OTP '222222' and click Verify OTP.`n3. Review the returned feedback on the page." -Expected "1. OTP verification fails because OTP '222222' has already expired.`n2. The flow stays on the OTP step and does not open the reset-password form." -Dependence 'The password-recovery flow is already at the OTP step for recover.user@gmail.com and OTP 222222 is expired.' -Note 'Trace: POST /auth/verify-otp expired-otp path.')
    (New-Case -Id 'Password Recovery - 6' -Description 'Reject password reset when the new password and confirm password fields do not match.' -Procedure "1. Open the reset-password step for 'recover.user@gmail.com' after valid OTP '246810' has been verified.`n2. Enter new password 'ResetPass@123' and confirm password 'ResetPass@124', then submit the form.`n3. Review the returned feedback on the page." -Expected "1. The password-reset request is rejected because the confirmation password does not match the new password.`n2. The user stays on the reset-password form and the current password remains unchanged." -Dependence 'OTP 246810 has already been verified for recover.user@gmail.com and the reset-password step is unlocked.' -Note 'Trace: POST /auth/reset-password mismatched confirmation path.')
    (New-Case -Id 'Password Recovery - 7' -Description 'Reject password reset when the new password does not satisfy the password policy.' -Procedure "1. Open the reset-password step for 'recover.user@gmail.com' after valid OTP '246810' has been verified.`n2. Enter new password '123456' and confirm password '123456', then submit the form.`n3. Review the returned feedback on the page." -Expected "1. The password-reset request is rejected because password '123456' does not satisfy the required strength policy.`n2. The user stays on the reset-password form and the current password remains unchanged." -Dependence 'OTP 246810 has already been verified for recover.user@gmail.com and password-strength validation is active.' -Note 'Trace: POST /auth/reset-password weak-password path.')
  ))
  (New-Section -Header 'Authorization Guard & Profile Access (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Authorization Guard & Profile Access - 1' -Description 'Load the profile screen successfully for an authenticated freelancer account.' -Procedure "1. Sign in with email 'verified.user@gmail.com' and password 'StrongPass@123'.`n2. Open the Profile page from the authenticated navigation menu.`n3. Wait for the page to load the current profile data." -Expected "1. The Profile page loads the authenticated user's current data without leaving the protected layout.`n2. The current profile fields, role badge, and KYC-related account summary are visible for the signed-in account." -Dependence 'The freelancer account verified.user@gmail.com is signed in and allowed to access the Profile page.' -Note 'Trace: ProfilePage -> GET /auth/profile.')
    (New-Case -Id 'Authorization Guard & Profile Access - 2' -Description 'Update supported profile fields and keep the refreshed values visible after saving.' -Procedure "1. Sign in as 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Change full name to 'Bao Nguyen Updated', phone to '0901234567', timezone to 'Asia/Ho_Chi_Minh', and bio to 'Senior frontend engineer for marketplace projects.', then click Save.`n3. Wait for the profile refetch and review the rendered values." -Expected "1. The profile-update request succeeds and stores 'Bao Nguyen Updated', '0901234567', 'Asia/Ho_Chi_Minh', and the new bio.`n2. The Profile page refetches data and shows the updated values after saving." -Dependence 'The signed-in account is allowed to edit its own profile data and validation rules accept the submitted values.' -Note 'Trace: PUT /auth/profile -> profile refetch.')
    (New-Case -Id 'Authorization Guard & Profile Access - 3' -Description 'Block a non-admin user from opening an admin-only route protected by RoleGuard.' -Procedure "1. Sign in as client account 'lan.client.it02@gmail.com' with password 'ClientPass@123'.`n2. Try to open the Admin Reviews page from a direct browser URL or protected navigation shortcut.`n3. Observe the rendered page after RoleGuard evaluates the current role." -Expected "1. The client account is not allowed to stay on the admin-only page.`n2. RoleGuard redirects the user to a safe route and no admin-only content is rendered." -Dependence 'The signed-in account has role Client and the target page is protected for Admin or Staff only.' -Note 'Trace: RoleGuard blocks unauthorized access to admin route.')
    (New-Case -Id 'Authorization Guard & Profile Access - 4' -Description 'Reject access to the Profile page when no authenticated session exists in the browser.' -Procedure "1. Clear the current browser cookies and local authenticated state.`n2. Try to open the Profile page directly.`n3. Observe the rendered route." -Expected "1. The guest user is not allowed to access the Profile page.`n2. The app redirects the guest user to the Sign In page." -Dependence 'No authenticated session exists in the current browser.' -Note 'Trace: protected route guard for Profile page.')
    (New-Case -Id 'Authorization Guard & Profile Access - 5' -Description 'Reject profile update when the submitted LinkedIn URL does not have a valid URL format.' -Procedure "1. Sign in as 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Enter LinkedIn URL 'linkedin-profile' and click Save.`n3. Review the validation feedback on the page." -Expected "1. The profile update is blocked because 'linkedin-profile' is not a valid URL.`n2. The user stays on the Profile page and the existing LinkedIn URL remains unchanged." -Dependence 'URL validation is active for the LinkedIn field in the current profile form.' -Note 'Trace: PUT /auth/profile invalid LinkedIn URL path.')
  ))
)

$kycSections = @(
  (New-Section -Header 'Submit KYC (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Submit KYC - 1' -Description 'Submit a complete KYC package with valid identity information and required document images.' -Procedure "1. Open the KYC Verification page as 'verified.user@gmail.com'.`n2. Enter full name 'Nguyen Gia Bao', document number '079123456789', date of birth '2000-01-15', address '123 Nguyen Trai, District 5, Ho Chi Minh City', and upload files 'cccd_front_valid.jpg', 'cccd_back_valid.jpg', and 'selfie_valid.jpg'.`n3. Click Submit KYC and wait for the confirmation state." -Expected "1. The KYC submission request succeeds and stores a new KYC record for 'Nguyen Gia Bao' with the uploaded document package.`n2. The KYC status screen shows the new submission in review or approved state according to the current AI and manual review result." -Dependence 'The signed-in user is allowed to submit KYC and the required sample image files are available.' -Note 'Trace: KYCPage -> POST /kyc.')
    (New-Case -Id 'Submit KYC - 2' -Description 'Block KYC submission when one of the required image files is missing.' -Procedure "1. Open the KYC Verification page as 'verified.user@gmail.com'.`n2. Enter full name 'Nguyen Gia Bao', document number '079123456789', date of birth '2000-01-15', address '123 Nguyen Trai, District 5, Ho Chi Minh City', upload only 'cccd_front_valid.jpg' and 'selfie_valid.jpg', and leave the back image empty.`n3. Click Submit KYC and inspect the validation feedback." -Expected "1. The KYC submission is blocked because the required document back image is missing.`n2. The form stays on the KYC page and shows a clear validation message for the missing required file." -Dependence 'The signed-in user can access the KYC form and client-side validation is active.' -Note 'Trace: KYCPage client validation before POST /kyc.')
    (New-Case -Id 'Submit KYC - 3' -Description 'Allow a user with an already approved KYC profile to submit an updated KYC package for re-review.' -Procedure "1. Sign in as a user whose current KYC is already approved and open the Update KYC flow from Profile or KYC Status.`n2. Enter full name 'Nguyen Gia Bao', document number '079987654321', date of birth '2000-01-15', address '45 Le Loi, District 1, Ho Chi Minh City', and upload files 'cccd_front_new.jpg', 'cccd_back_new.jpg', and 'selfie_new.jpg'.`n3. Click Submit KYC and wait for the post-submit state." -Expected "1. The updated KYC package is accepted as a new submission for manual or AI review instead of being rejected only because an old KYC was already approved.`n2. The user can see that a new KYC package is pending review while the previous approved verification remains the effective verified state until the new package is reviewed." -Dependence 'The signed-in user already has one approved KYC record and is allowed to open the Update KYC flow.' -Note 'Trace: KYCPage update flow -> POST /kyc resubmission path.')
    (New-Case -Id 'Submit KYC - 4' -Description 'Reject the KYC submission when the document number is entered in an invalid format.' -Procedure "1. Open the KYC Verification page as 'verified.user@gmail.com'.`n2. Enter full name 'Nguyen Gia Bao', document number 'ABC123', date of birth '2000-01-15', address '123 Nguyen Trai, District 5, Ho Chi Minh City', upload files 'cccd_front_valid.jpg', 'cccd_back_valid.jpg', and 'selfie_valid.jpg'.`n3. Click Submit KYC and inspect the validation feedback." -Expected "1. The KYC submission is blocked because document number 'ABC123' does not satisfy the accepted identity-number format.`n2. The form stays on the KYC page and no new KYC record is created." -Dependence 'Document-number validation is active on the KYC submission form or backend endpoint.' -Note 'Trace: KYCPage validation for document-number format.')
    (New-Case -Id 'Submit KYC - 5' -Description 'Reject a second KYC submission while the user already has one latest KYC package in Pending status.' -Procedure "1. Sign in as 'pending.kyc.user@gmail.com' whose latest KYC is already Pending.`n2. Open the KYC Verification page and enter another complete KYC package with files 'cccd_front_retry.jpg', 'cccd_back_retry.jpg', and 'selfie_retry.jpg'.`n3. Click Submit KYC and inspect the returned feedback." -Expected "1. The KYC submission is rejected because the user already has a pending KYC verification.`n2. No additional pending KYC record is created for the same user." -Dependence 'The signed-in account already has one latest KYC record in Pending status.' -Note 'Trace: POST /kyc pending-kyc guard path.')
    (New-Case -Id 'Submit KYC - 6' -Description 'Auto-approve a clean KYC package when AI verification and data matching both pass strongly.' -Procedure "1. Sign in as 'auto.approve.kyc@gmail.com'.`n2. Enter full name 'Auto Approve User', document number '079111222333', date of birth '1999-05-20', address '88 Nguyen Hue, District 1, Ho Chi Minh City', and upload files 'auto_front_match.jpg', 'auto_back_match.jpg', and 'auto_selfie_match.jpg'.`n3. Click Submit KYC and wait for the final status message." -Expected "1. The KYC submission is created successfully and receives Approved status immediately because AI verification and data matching pass the auto-approval threshold.`n2. The user sees the verified KYC state without waiting for manual review." -Dependence 'AI verification returns AUTO_APPROVED and the submitted data reaches the required match-score threshold.' -Note 'Trace: POST /kyc auto-approved branch.')
    (New-Case -Id 'Submit KYC - 7' -Description 'Auto-reject a KYC package when AI verification returns a hard reject without an unreadable-document issue.' -Procedure "1. Sign in as 'auto.reject.kyc@gmail.com'.`n2. Enter full name 'Auto Reject User', document number '079444555666', date of birth '1998-03-11', address '10 Phan Xich Long, Phu Nhuan, Ho Chi Minh City', and upload files 'auto_front_reject.jpg', 'auto_back_reject.jpg', and 'auto_selfie_reject.jpg'.`n3. Click Submit KYC and wait for the final status message." -Expected "1. The KYC submission is created successfully and receives Rejected status because AI verification returns AUTO_REJECTED without an unreadable-document exception.`n2. The user sees the rejected state and can review the rejection reason." -Dependence 'AI verification returns AUTO_REJECTED and the unreadable-document override does not apply.' -Note 'Trace: POST /kyc auto-rejected branch.')
    (New-Case -Id 'Submit KYC - 8' -Description 'Send the KYC package to manual review when AI cannot verify the package cleanly enough for auto-approval or auto-rejection.' -Procedure "1. Sign in as 'manual.review.kyc@gmail.com'.`n2. Enter full name 'Manual Review User', document number '079777888999', date of birth '1997-08-08', address '250 Cach Mang Thang 8, District 3, Ho Chi Minh City', and upload files 'manual_front.jpg', 'manual_back.jpg', and 'manual_selfie.jpg'.`n3. Click Submit KYC and wait for the final status message." -Expected "1. The KYC submission is created successfully and remains in Pending status for manual review.`n2. The user sees a message that the package is under review instead of being auto-approved or auto-rejected." -Dependence 'AI verification does not meet the auto-approve threshold and does not trigger hard auto-rejection.' -Note 'Trace: POST /kyc manual-review branch.')
  ))
  (New-Section -Header 'Get My KYC Status (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Get My KYC Status - 1' -Description 'Show the empty-state KYC screen for a user who has never submitted any KYC package.' -Procedure "1. Sign in as 'no.kyc.user@gmail.com'.`n2. Open the KYC Status page from the account menu.`n3. Wait for the page to finish loading." -Expected "1. The KYC Status page shows that no KYC submission exists for 'no.kyc.user@gmail.com'.`n2. The page offers the action to start KYC verification from the empty state." -Dependence 'The account no.kyc.user@gmail.com exists and has no KYC record yet.' -Note 'Trace: KYCStatusPage -> GET /kyc/me with no record.')
    (New-Case -Id 'Get My KYC Status - 2' -Description 'Show the pending-review state for a user whose KYC package has been submitted but not yet manually resolved.' -Procedure "1. Sign in as 'pending.kyc.user@gmail.com'.`n2. Open the KYC Status page.`n3. Read the status card and the status message that is displayed." -Expected "1. The KYC Status page shows Pending Review for 'pending.kyc.user@gmail.com'.`n2. The page explains that the submitted KYC package is still waiting for review." -Dependence 'The account pending.kyc.user@gmail.com has one latest KYC record in Pending status.' -Note 'Trace: KYCStatusPage -> GET /kyc/me pending path.')
    (New-Case -Id 'Get My KYC Status - 3' -Description 'Keep the effective verified state visible when an approved user submits a newer KYC update that is still pending.' -Procedure "1. Sign in as 'verified.update.kyc@gmail.com'.`n2. Open the KYC Status page after the account has one old approved KYC and one newer pending update package.`n3. Review the status card and the update notice." -Expected "1. The KYC Status page keeps the account in an effectively verified state because an approved KYC still exists.`n2. The page also shows that a newer KYC update package is currently pending review." -Dependence 'The account verified.update.kyc@gmail.com has one approved KYC record and one newer pending KYC submission.' -Note 'Trace: GET /kyc/me returns effective approved state plus pending update information.')
    (New-Case -Id 'Get My KYC Status - 4' -Description 'Show the rejected state for a user whose latest KYC submission was rejected and no approved KYC exists.' -Procedure "1. Sign in as 'rejected.kyc.user@gmail.com'.`n2. Open the KYC Status page.`n3. Read the status card and the rejection message." -Expected "1. The KYC Status page shows Rejected for 'rejected.kyc.user@gmail.com'.`n2. The page displays the rejection reason and offers the user a way to submit KYC again." -Dependence 'The account rejected.kyc.user@gmail.com has latest KYC in Rejected status and no approved KYC record.' -Note 'Trace: GET /kyc/me rejected path without approved fallback.')
    (New-Case -Id 'Get My KYC Status - 5' -Description 'Show the effective approved state plus rejected-update notice when a verified user submits a new KYC package that gets rejected.' -Procedure "1. Sign in as 'verified.rejected.update@gmail.com'.`n2. Open the KYC Status page after the account has one approved KYC and one newer rejected update package.`n3. Review the status card and update message." -Expected "1. The KYC Status page keeps the account effectively verified because an older approved KYC still exists.`n2. The page also shows that the latest KYC update was rejected and displays the rejection message." -Dependence 'The account verified.rejected.update@gmail.com has one approved KYC and one newer rejected update record.' -Note 'Trace: GET /kyc/me effective approved state plus rejected update notice.')
  ))
  (New-Section -Header 'List KYC Queue (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'List KYC Queue - 1' -Description 'Load the KYC review queue successfully as an Admin account.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the KYC administration queue screen.`n3. Wait for the queue data to load." -Expected "1. The KYC queue screen loads the current pending KYC submissions for admin review.`n2. The admin account can see the list items and summary information without authorization errors." -Dependence 'The admin account admin27@interdev.local exists and one or more KYC submissions are pending review.' -Note 'Trace: Admin KYC queue -> GET /kyc/admin/all as Admin.')
    (New-Case -Id 'List KYC Queue - 2' -Description 'Load the KYC review queue successfully when the reviewer opens the screen without any explicit filter.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the KYC administration queue screen without setting status, page, or limit filters.`n3. Wait for the queue data to load." -Expected "1. The KYC queue screen loads successfully with the default query settings when filters are omitted.`n2. The admin reviewer can still see the queue items and pagination summary." -Dependence 'The admin account is signed in and the KYC review queue supports omitted filters with default behavior.' -Note 'Trace: GET /kyc/admin/all with omitted filters.')
    (New-Case -Id 'List KYC Queue - 3' -Description 'Load the same KYC review queue successfully as a Staff account.' -Procedure "1. Sign in as staff account 'staff.review@interdev.local'.`n2. Open the KYC administration queue screen.`n3. Wait for the queue data to load." -Expected "1. The KYC queue screen loads the current pending KYC submissions for the staff reviewer.`n2. The staff account can see the list items without authorization errors." -Dependence 'The staff account staff.review@interdev.local exists and has Staff permission for KYC review.' -Note 'Trace: Admin KYC queue -> GET /kyc/admin/all as Staff.')
    (New-Case -Id 'List KYC Queue - 4' -Description 'Block a non-review user from opening the KYC review queue.' -Procedure "1. Sign in as client account 'lan.client.it02@gmail.com'.`n2. Try to open the KYC review queue screen reserved for Admin or Staff.`n3. Observe the final route and the rendered content." -Expected "1. The client account is not allowed to load the KYC review queue.`n2. The app redirects the user away from the reviewer-only area and does not render the queue content." -Dependence 'The client account is signed in and the target page is protected for Admin or Staff only.' -Note 'Trace: role protection for KYC queue screen.')
    (New-Case -Id 'List KYC Queue - 5' -Description 'Reject the queue request when the reviewer applies an invalid status filter.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the KYC queue screen with an invalid status filter value 'WAITING_RECHECK'.`n3. Observe the returned page state or error feedback." -Expected "1. The KYC queue request fails with a clear invalid-status message for filter 'WAITING_RECHECK'.`n2. The screen stays stable and does not render broken queue data for the invalid filter." -Dependence 'The KYC queue screen supports a status filter and the backend validates the submitted filter value.' -Note 'Trace: GET /kyc/admin/all invalid status filter path.')
  ))
  (New-Section -Header 'Review KYC Detail With Watermark (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Review KYC Detail With Watermark - 1' -Description 'Open the KYC detail screen with watermark-rendered files as an Admin reviewer.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. From the KYC queue, open KYC record 'KYC-1001'.`n3. Review the detailed information and the watermarked document preview." -Expected "1. The KYC detail screen loads the identity information and watermarked files for KYC-1001.`n2. The admin reviewer can inspect the document package without file-access errors." -Dependence 'KYC record KYC-1001 exists and the admin account is allowed to review it.' -Note 'Trace: GET /kyc/admin/:id and GET /kyc/admin/:id/watermark as Admin.')
    (New-Case -Id 'Review KYC Detail With Watermark - 2' -Description 'Open the same KYC detail screen with watermark-rendered files as a Staff reviewer.' -Procedure "1. Sign in as staff account 'staff.review@interdev.local'.`n2. From the KYC queue, open KYC record 'KYC-1001'.`n3. Review the detail screen and watermark preview." -Expected "1. The KYC detail screen loads correctly for the staff reviewer.`n2. The watermark-rendered files are visible without authorization errors." -Dependence 'KYC record KYC-1001 exists and Staff has permission to review it.' -Note 'Trace: GET /kyc/admin/:id/watermark as Staff.')
    (New-Case -Id 'Review KYC Detail With Watermark - 3' -Description 'Load watermarked KYC detail successfully even when request metadata is missing and the backend must use fallback reviewer metadata.' -Procedure "1. Sign in as staff account 'staff.review@interdev.local'.`n2. Open KYC record 'KYC-1002' from a browser session that does not send request id or user-agent metadata to the watermark endpoint.`n3. Review the detail screen and watermark preview." -Expected "1. The KYC detail screen still loads correctly for KYC-1002 even when request metadata is incomplete.`n2. The watermark preview is rendered successfully with fallback metadata instead of failing the review flow." -Dependence 'KYC record KYC-1002 exists and the review endpoint supports fallback metadata when request metadata is missing.' -Note 'Trace: GET /kyc/admin/:id/watermark fallback metadata path.')
    (New-Case -Id 'Review KYC Detail With Watermark - 4' -Description 'Show a not-found error when the reviewer opens a KYC id that does not exist.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the KYC detail screen for non-existent id 'KYC-9999'.`n3. Review the error state returned by the page." -Expected "1. The KYC detail request fails with a clear not-found error for KYC-9999.`n2. No watermark preview is rendered for a missing KYC record." -Dependence 'The KYC id KYC-9999 does not exist in the review database.' -Note 'Trace: GET /kyc/admin/:id negative path.')
  ))
  (New-Section -Header 'Approve KYC (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Approve KYC - 1' -Description 'Approve a pending KYC submission successfully as an Admin reviewer.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open pending KYC record 'KYC-2001' in the review screen.`n3. Click Approve and wait for the status update to complete." -Expected "1. KYC record KYC-2001 changes from Pending to Approved after the admin confirms approval.`n2. The review queue and detail screen both show the updated Approved status." -Dependence 'KYC-2001 exists in Pending status and the admin reviewer is allowed to approve it.' -Note 'Trace: PATCH /kyc/admin/:id/approve as Admin.')
    (New-Case -Id 'Approve KYC - 2' -Description 'Approve a pending KYC submission successfully as a Staff reviewer.' -Procedure "1. Sign in as staff account 'staff.review@interdev.local'.`n2. Open pending KYC record 'KYC-2002' in the review screen.`n3. Click Approve and wait for the status update to complete." -Expected "1. KYC record KYC-2002 changes from Pending to Approved after the staff reviewer confirms approval.`n2. The review queue and detail screen both show the updated Approved status." -Dependence 'KYC-2002 exists in Pending status and the staff reviewer is allowed to approve it.' -Note 'Trace: PATCH /kyc/admin/:id/approve as Staff.')
    (New-Case -Id 'Approve KYC - 3' -Description 'Reject the approve action when the selected KYC record has already been reviewed.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open already approved KYC record 'KYC-2003'.`n3. Click Approve again and inspect the returned error message." -Expected "1. The approve action is rejected because KYC-2003 is no longer in Pending status.`n2. The existing reviewed status remains unchanged after the failed approve action." -Dependence 'KYC-2003 exists but is already Approved or Rejected before the reviewer clicks Approve.' -Note 'Trace: PATCH /kyc/admin/:id/approve guard against non-pending records.')
    (New-Case -Id 'Approve KYC - 4' -Description 'Reject the approve action when the selected KYC id does not exist.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open non-existent KYC record 'KYC-9998' in the review screen.`n3. Click Approve and inspect the returned error message." -Expected "1. The approve action fails because KYC-9998 does not exist.`n2. No other KYC record is modified by the failed approve attempt." -Dependence 'The KYC id KYC-9998 does not exist in the review database.' -Note 'Trace: PATCH /kyc/admin/:id/approve not-found path.')
    (New-Case -Id 'Approve KYC - 5' -Description 'Expire stale older approved KYC records when a newer pending KYC package is approved.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open pending update KYC record 'KYC-2004' for a user who already has older approved KYC records.`n3. Click Approve and review the latest status outcome for both the new and old KYC records." -Expected "1. KYC-2004 changes from Pending to Approved.`n2. Older approved KYC records for the same user are changed to Expired so only the latest approved KYC remains active." -Dependence 'The selected user has one or more older approved KYC records before KYC-2004 is approved.' -Note 'Trace: approve KYC path expires stale approved records.')
  ))
  (New-Section -Header 'Reject KYC (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Reject KYC - 1' -Description 'Reject a pending KYC submission with a reviewer reason as an Admin reviewer.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open pending KYC record 'KYC-3001' in the review screen.`n3. Enter rejection reason 'Document number is unreadable' and click Reject." -Expected "1. KYC-3001 changes from Pending to Rejected with reason 'Document number is unreadable'.`n2. The rejected status and rejection reason are visible on the review screen after the action completes." -Dependence 'KYC-3001 exists in Pending status and the admin reviewer is allowed to reject it.' -Note 'Trace: PATCH /kyc/admin/:id/reject as Admin.')
    (New-Case -Id 'Reject KYC - 2' -Description 'Reject a pending KYC submission with a reviewer reason as a Staff reviewer.' -Procedure "1. Sign in as staff account 'staff.review@interdev.local'.`n2. Open pending KYC record 'KYC-3002' in the review screen.`n3. Enter rejection reason 'Selfie image does not match the document photo' and click Reject." -Expected "1. KYC-3002 changes from Pending to Rejected with reason 'Selfie image does not match the document photo'.`n2. The rejected status and rejection reason are visible on the review screen after the action completes." -Dependence 'KYC-3002 exists in Pending status and the staff reviewer is allowed to reject it.' -Note 'Trace: PATCH /kyc/admin/:id/reject as Staff.')
    (New-Case -Id 'Reject KYC - 3' -Description 'Reject the reject action when the selected KYC record has already been reviewed.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open already rejected KYC record 'KYC-3003'.`n3. Enter another rejection reason and click Reject again." -Expected "1. The reject action is blocked because KYC-3003 is no longer in Pending status.`n2. The existing reviewed status and existing rejection reason remain unchanged." -Dependence 'KYC-3003 already exists in Rejected or Approved status before the reviewer retries Reject.' -Note 'Trace: PATCH /kyc/admin/:id/reject guard against non-pending records.')
    (New-Case -Id 'Reject KYC - 4' -Description 'Reject the reject action when the reviewer submits an empty rejection reason.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open pending KYC record 'KYC-3004'.`n3. Leave the rejection reason empty and click Reject." -Expected "1. The reject action is blocked because a rejection reason is required for KYC-3004.`n2. The selected KYC record remains in Pending status after the failed reject attempt." -Dependence 'KYC-3004 exists in Pending status and the reject form validates the rejection reason.' -Note 'Trace: PATCH /kyc/admin/:id/reject missing reason path.')
    (New-Case -Id 'Reject KYC - 5' -Description 'Reject the reject action when the selected KYC id does not exist.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open non-existent KYC record 'KYC-9997' in the review screen.`n3. Enter rejection reason 'Record not valid' and click Reject." -Expected "1. The reject action fails because KYC-9997 does not exist.`n2. No other KYC record is modified by the failed reject attempt." -Dependence 'The KYC id KYC-9997 does not exist in the review database.' -Note 'Trace: PATCH /kyc/admin/:id/reject not-found path.')
  ))
)

$userSections = @(
  (New-Section -Header 'View Profile Details (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'View Profile Details - 1' -Description 'Load the profile page successfully for a client account with no KYC verification yet.' -Procedure "1. Sign in as client account 'lan.client.it02@gmail.com' with password 'ClientPass@123'.`n2. Open the Profile page from the authenticated menu.`n3. Wait for the profile data to load." -Expected "1. The Profile page loads the current client data for 'lan.client.it02@gmail.com'.`n2. The account card shows the unverified KYC state and the Start KYC Verification action." -Dependence 'The client account lan.client.it02@gmail.com exists and can sign in successfully.' -Note 'Trace: ProfilePage -> GET /auth/profile for Client.')
    (New-Case -Id 'View Profile Details - 2' -Description 'Load the profile page successfully for a verified freelancer account that already has trust and KYC data.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' with password 'StrongPass@123'.`n2. Open the Profile page from the authenticated menu.`n3. Wait for the page to load account and professional information." -Expected "1. The Profile page loads the current freelancer data, trust information, and current KYC state.`n2. The account card shows Update KYC because the user is already verified." -Dependence 'The freelancer account verified.user@gmail.com exists, is email verified, and has verified KYC data.' -Note 'Trace: ProfilePage -> GET /auth/profile for verified Freelancer.')
    (New-Case -Id 'View Profile Details - 3' -Description 'Load the profile page successfully for a verified user who already has one older approved KYC and one newer pending update.' -Procedure "1. Sign in as freelancer account 'verified.update.kyc@gmail.com' with password 'StrongPass@123'.`n2. Open the Profile page from the authenticated menu.`n3. Review the KYC card after the page finishes loading." -Expected "1. The Profile page loads successfully and keeps the account in a verified state because one approved KYC still exists.`n2. The KYC card also shows that a newer KYC update is currently pending review." -Dependence 'The signed-in freelancer account has one approved KYC and one newer pending KYC update record.' -Note 'Trace: ProfilePage loads effective verified state plus pending KYC update notice.')
    (New-Case -Id 'View Profile Details - 4' -Description 'Redirect an unauthenticated user away from the profile page.' -Procedure "1. Clear the current browser session or open the app in a fresh guest session.`n2. Try to open the Profile page directly.`n3. Observe the route that is rendered." -Expected "1. The guest user is not allowed to stay on the Profile page.`n2. The app redirects the guest user to the Sign In page." -Dependence 'No authenticated session exists in the current browser.' -Note 'Trace: protected profile route requires authenticated session.')
  ))
  (New-Section -Header 'Update Profile Core Information (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Update Profile Core Information - 1' -Description 'Update user-core fields such as full name, phone number, and timezone successfully.' -Procedure "1. Sign in as 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Change full name to 'Bao Nguyen Updated', phone number to '0901234567', and timezone to 'Asia/Ho_Chi_Minh', then click Save Changes.`n3. Wait for the profile to refresh after the update call." -Expected "1. The profile update succeeds and stores full name 'Bao Nguyen Updated', phone number '0901234567', and timezone 'Asia/Ho_Chi_Minh'.`n2. The Profile page reloads with the updated user-core values visible." -Dependence 'The signed-in account is allowed to update its own user-core fields.' -Note 'Trace: PUT /auth/profile for user fields.')
    (New-Case -Id 'Update Profile Core Information - 2' -Description 'Update profile-side fields such as company name and LinkedIn URL successfully.' -Procedure "1. Sign in as 'lan.client.it02@gmail.com' and open the Profile page in edit mode.`n2. Change company name to 'BaoNG Digital Studio', LinkedIn URL to 'https://www.linkedin.com/in/baong-it', and bio to 'Product owner for marketplace transformation projects.', then click Save Changes.`n3. Wait for the profile to refresh." -Expected "1. The profile update succeeds and stores company name 'BaoNG Digital Studio', the LinkedIn URL, and the new bio.`n2. The Profile page reloads with the updated profile-side fields visible." -Dependence 'The signed-in account is allowed to update its own profile-side fields.' -Note 'Trace: PUT /auth/profile for profile fields.')
    (New-Case -Id 'Update Profile Core Information - 3' -Description 'Reject the save action when the phone number format is invalid.' -Procedure "1. Sign in as 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Enter phone number 'abc123' and click Save Changes.`n3. Observe the validation feedback on the form." -Expected "1. The profile update is blocked because phone number 'abc123' does not satisfy validation rules.`n2. The form stays in edit mode and the invalid phone-number message is displayed." -Dependence 'Client-side or server-side validation is active for phone-number format.' -Note 'Trace: ProfilePage validation before successful PUT /auth/profile.')
    (New-Case -Id 'Update Profile Core Information - 4' -Description 'Reject the save action when the LinkedIn URL format is invalid.' -Procedure "1. Sign in as 'lan.client.it02@gmail.com' and open the Profile page in edit mode.`n2. Enter LinkedIn URL 'linkedin-profile' and click Save Changes.`n3. Observe the validation feedback on the form." -Expected "1. The profile update is blocked because LinkedIn URL 'linkedin-profile' does not satisfy URL validation rules.`n2. The form stays in edit mode and the invalid LinkedIn URL message is displayed." -Dependence 'Client-side or server-side validation is active for URL format on profile fields.' -Note 'Trace: ProfilePage validation for invalid LinkedIn URL.')
    (New-Case -Id 'Update Profile Core Information - 5' -Description 'Save only profile-side fields successfully without changing user-core fields.' -Procedure "1. Sign in as 'lan.client.it02@gmail.com' and open the Profile page in edit mode.`n2. Keep full name, phone number, and timezone unchanged, but update company name to 'BaoNG Strategy Lab' and bio to 'Business stakeholder for enterprise platform delivery.', then click Save Changes.`n3. Wait for the profile to refresh." -Expected "1. The update succeeds for company name and bio while user-core fields remain unchanged.`n2. The Profile page reloads with only the profile-side values updated." -Dependence 'The current profile already has existing user-core fields and the account can edit its own profile-side data.' -Note 'Trace: PUT /auth/profile profile-only update path.')
    (New-Case -Id 'Update Profile Core Information - 6' -Description 'Save only user-core fields successfully without changing profile-side fields.' -Procedure "1. Sign in as 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Change full name to 'Bao Nguyen Core Only' and phone number to '0909998888', but leave bio, company name, and LinkedIn URL unchanged, then click Save Changes.`n3. Wait for the profile to refresh." -Expected "1. The update succeeds for full name and phone number while profile-side fields remain unchanged.`n2. The Profile page reloads with only the user-core values updated." -Dependence 'The account can edit its own user-core data and existing profile-side data is already present.' -Note 'Trace: PUT /auth/profile user-only update path.')
  ))
  (New-Section -Header 'Upload CV (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Upload CV - 1' -Description 'Upload the first CV file successfully for a freelancer account with no current CV.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. In the CV/Resume section choose file 'BaoNG_CV_2026.pdf'.`n3. Save or wait for the upload flow to complete, then review the CV section." -Expected "1. The CV upload succeeds and stores 'BaoNG_CV_2026.pdf' as the current CV file for the account.`n2. The Profile page shows the uploaded CV as the current downloadable resume." -Dependence 'The signed-in freelancer account is allowed to upload CV files and BaoNG_CV_2026.pdf is a supported file type.' -Note 'Trace: CVUpload -> POST /profile/cv.')
    (New-Case -Id 'Upload CV - 2' -Description 'Replace the current CV with a newer PDF file successfully.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' with existing CV 'BaoNG_CV_2026.pdf'.`n2. In the CV/Resume section choose replacement file 'BaoNG_CV_2026_v2.pdf'.`n3. Complete the upload flow and review the CV section again." -Expected "1. The replacement upload succeeds and 'BaoNG_CV_2026_v2.pdf' becomes the current CV file.`n2. The CV section now points to the replacement file instead of the older resume." -Dependence 'A current CV already exists for the signed-in freelancer account.' -Note 'Trace: CV replacement flow via POST /profile/cv.')
    (New-Case -Id 'Upload CV - 3' -Description 'Reject the upload when the selected file format is not supported.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. In the CV/Resume section choose file 'BaoNG_CV_2026.exe'.`n3. Attempt to continue the upload and inspect the feedback message." -Expected "1. The upload is blocked because BaoNG_CV_2026.exe is not a supported CV file type.`n2. The current CV remains unchanged after the failed upload attempt." -Dependence 'Client-side or server-side validation rejects unsupported CV file formats.' -Note 'Trace: CVUpload validation for unsupported file type.')
    (New-Case -Id 'Upload CV - 4' -Description 'Reject the upload when the selected CV file exceeds the maximum allowed size.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. In the CV/Resume section choose file 'BaoNG_CV_8MB.pdf'.`n3. Attempt to continue the upload and inspect the feedback message." -Expected "1. The upload is blocked because BaoNG_CV_8MB.pdf exceeds the 5MB size limit.`n2. The current CV remains unchanged after the failed upload attempt." -Dependence 'Client-side or server-side validation rejects files larger than the configured 5MB CV size limit.' -Note 'Trace: CVUpload validation for oversized file.')
    (New-Case -Id 'Upload CV - 5' -Description 'Reject the upload when the user clicks upload without choosing any file first.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Open the CV/Resume upload action but do not choose any file.`n3. Try to continue the upload and inspect the feedback message." -Expected "1. The upload is blocked because no file was selected.`n2. The current CV remains unchanged after the failed upload attempt." -Dependence 'The upload action validates that one file must be chosen before sending the request.' -Note 'Trace: POST /profile/cv no-file path.')
    (New-Case -Id 'Upload CV - 6' -Description 'Show a stable error when the storage provider fails during CV upload.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Choose file 'BaoNG_CV_2026.pdf'.`n3. Continue the upload while the storage provider returns upload error 'storage timeout'." -Expected "1. The upload fails with a clear storage-error message.`n2. The current CV remains unchanged after the failed upload attempt." -Dependence 'The upload request reaches the backend, but the storage provider returns an upload failure.' -Note 'Trace: POST /profile/cv upload-failed path.')
  ))
  (New-Section -Header 'View and Delete CV (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'View and Delete CV - 1' -Description 'Return a null CV payload when the signed-in user has not uploaded any resume yet.' -Procedure "1. Sign in as freelancer account 'no.cv.user@gmail.com'.`n2. Open the Profile page and navigate to the CV/Resume section.`n3. Wait for the CV state request to finish." -Expected "1. The CV section shows the no-CV placeholder for 'no.cv.user@gmail.com'.`n2. No broken download link is rendered because the backend returns no current CV." -Dependence 'The account no.cv.user@gmail.com exists and does not have any uploaded CV file.' -Note 'Trace: GET /profile/cv returns null state.')
    (New-Case -Id 'View and Delete CV - 2' -Description 'Open the stored public CV URL successfully from the profile screen.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' whose profile stores public CV URL 'https://cdn.example.com/member-cv.pdf'.`n2. Open the Profile page and click View or Download in the CV section.`n3. Wait for the browser to load the selected file." -Expected "1. The public CV URL opens or downloads successfully.`n2. The user can review the current resume without URL-signing errors." -Dependence 'The signed-in freelancer account stores a public CV URL directly in the profile.' -Note 'Trace: GET /profile/cv returns stored public URL as-is.')
    (New-Case -Id 'View and Delete CV - 3' -Description 'Open a storage-backed CV successfully when the backend generates a signed download URL.' -Procedure "1. Sign in as freelancer account 'signed.cv.user@gmail.com' whose profile stores CV path 'cvs/user-1/member-cv.pdf'.`n2. Open the Profile page and click View or Download in the CV section.`n3. Wait for the browser to load the signed file URL." -Expected "1. The backend generates a signed download URL for the stored CV path.`n2. The signed CV file opens successfully from the Profile page." -Dependence 'The signed-in account stores a CV path in storage and the storage signer is available.' -Note 'Trace: GET /profile/cv signed-url path.')
    (New-Case -Id 'View and Delete CV - 4' -Description 'Show a stable not-found error when the stored CV path no longer exists in storage.' -Procedure "1. Sign in as freelancer account 'broken.cv.user@gmail.com' whose profile still stores CV path 'cvs/missing_resume.pdf'.`n2. Open the Profile page and click View or Download in the CV section.`n3. Observe the returned feedback." -Expected "1. The CV retrieval request fails with a clear file-not-found message for the missing storage object.`n2. The page stays stable and does not render a broken file preview." -Dependence 'The account broken.cv.user@gmail.com exists and its stored CV path points to a file that no longer exists in storage.' -Note 'Trace: GET /profile/cv not-found path.')
    (New-Case -Id 'View and Delete CV - 5' -Description 'Delete the existing CV successfully and return the profile to the no-CV state.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' with current CV 'BaoNG_CV_2026_v2.pdf'.`n2. Open the Profile page and click Delete in the CV section, then confirm the action.`n3. Wait for the profile to refresh after deletion." -Expected "1. The current CV file is deleted successfully from the account.`n2. The CV section returns to the no-CV state and no longer shows the deleted file." -Dependence 'The signed-in freelancer account already has an uploaded CV file that can be deleted.' -Note 'Trace: DELETE /profile/cv success path.')
    (New-Case -Id 'View and Delete CV - 6' -Description 'Reject CV deletion when the user does not have any stored CV file.' -Procedure "1. Sign in as freelancer account 'no.cv.user@gmail.com'.`n2. Open the Profile page and trigger Delete in the CV section through a direct request or stale UI state.`n3. Review the returned feedback." -Expected "1. The delete request fails because no CV exists for 'no.cv.user@gmail.com'.`n2. The page remains stable and the CV section still shows the no-CV placeholder." -Dependence 'The account no.cv.user@gmail.com exists and has no stored CV file.' -Note 'Trace: DELETE /profile/cv no-cv path.')
    (New-Case -Id 'View and Delete CV - 7' -Description 'Clear the profile CV reference successfully even when the storage provider reports a delete error.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' whose profile stores current CV 'BaoNG_CV_2026_v2.pdf'.`n2. Open the Profile page and click Delete in the CV section.`n3. Confirm the action while the storage provider returns delete error 'Storage removal failed'." -Expected "1. The delete flow still completes successfully and clears the CV reference from the profile.`n2. The Profile page returns to the no-CV state even though storage deletion reported an error." -Dependence 'The profile has an existing CV and the controller is configured to clear the profile reference even when storage removal fails.' -Note 'Trace: DELETE /profile/cv storage-error but success path.')
  ))
  (New-Section -Header 'Update Bio (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Update Bio - 1' -Description 'Create a new bio successfully when the user does not have a profile bio yet.' -Procedure "1. Sign in as client account 'lan.client.it02@gmail.com' and open the Profile page in edit mode.`n2. Enter bio 'Product owner with 8 years of experience delivering marketplace transformation projects.' and click Save Changes.`n3. Wait for the profile to refresh." -Expected "1. The new bio is saved successfully for 'lan.client.it02@gmail.com'.`n2. The Profile page shows the saved bio after the refresh completes." -Dependence 'The signed-in account is allowed to update its own bio and currently has no stored bio.' -Note 'Trace: PATCH /profile/bio create-profile path.')
    (New-Case -Id 'Update Bio - 2' -Description 'Update an existing bio successfully with trimmed professional wording.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Replace the current bio with '  Senior frontend engineer focused on React, marketplace UX, and real-time collaboration.  ' and click Save Changes.`n3. Wait for the profile to refresh." -Expected "1. The updated bio text is saved successfully for 'verified.user@gmail.com'.`n2. The Profile page shows the trimmed edited bio after the refresh completes." -Dependence 'The signed-in account already has one existing bio value.' -Note 'Trace: PATCH /profile/bio update existing bio path.')
    (New-Case -Id 'Update Bio - 3' -Description 'Reject the bio update when the submitted text is blank or whitespace only.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Enter bio value '   ' and click Save Changes.`n3. Observe the validation feedback." -Expected "1. The bio update is blocked because blank or whitespace-only bio text is not allowed.`n2. The existing bio remains unchanged after the failed save attempt." -Dependence 'Bio validation rejects empty or whitespace-only values.' -Note 'Trace: PATCH /profile/bio empty-bio path.')
    (New-Case -Id 'Update Bio - 4' -Description 'Reject the bio update when the submitted text exceeds the maximum allowed length.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Profile page in edit mode.`n2. Paste a biography text longer than 1000 characters into the bio field and click Save Changes.`n3. Observe the validation feedback." -Expected "1. The bio update is blocked because the submitted text exceeds the 1000-character limit.`n2. The existing bio remains unchanged after the failed save attempt." -Dependence 'Bio-length validation is active for the current profile form or backend endpoint.' -Note 'Trace: PATCH /profile/bio overlong-bio path.')
  ))
  (New-Section -Header 'Manage Skills Portfolio (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Manage Skills Portfolio - 1' -Description 'Load the existing skills list for a freelancer account successfully.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com'.`n2. Open the Profile page and move to the Skills section.`n3. Wait for the current skill tags to load." -Expected "1. The Skills section loads the current selected skills for 'verified.user@gmail.com'.`n2. The page renders the current skill tags without errors from the skills service." -Dependence 'The signed-in freelancer account has one or more saved skills.' -Note 'Trace: GET /profile/skills from Profile page.')
    (New-Case -Id 'Manage Skills Portfolio - 2' -Description 'Save a new set of selected skills successfully.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Skills editor.`n2. Select skills 'ReactJS', 'TypeScript', and 'Node.js', then click Save Skills.`n3. Wait for the page to refresh the saved selections." -Expected "1. The selected skills ReactJS, TypeScript, and Node.js are saved successfully for 'verified.user@gmail.com'.`n2. The Skills section reloads and shows the same three saved skill tags." -Dependence 'The selected skill options ReactJS, TypeScript, and Node.js exist in the skills catalog.' -Note 'Trace: PUT /profile/skills replace-skill-set path.')
    (New-Case -Id 'Manage Skills Portfolio - 3' -Description 'Return zero added and removed counts when the submitted skills already match the current saved set.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' whose current skills are already 'ReactJS' and 'TypeScript'.`n2. Open the Skills editor and submit the same two skills again without any changes.`n3. Wait for the page to refresh the saved selections." -Expected "1. The skills update succeeds without changing the saved set because the submitted skills already match the current values.`n2. The Skills section stays unchanged after the refresh." -Dependence 'The signed-in freelancer account already has the same skills that are submitted in the update request.' -Note 'Trace: PUT /profile/skills already-match path.')
    (New-Case -Id 'Manage Skills Portfolio - 4' -Description 'Reject the save action when skillIds is not submitted as an array.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Skills editor.`n2. Submit skillIds value 'skill-react' as plain text instead of an array and click Save Skills.`n3. Observe the returned feedback after the save attempt." -Expected "1. The skills update is blocked because skillIds must be an array.`n2. The existing saved skill list remains unchanged after the failed update attempt." -Dependence 'The backend validates that skillIds must be submitted as an array.' -Note 'Trace: PUT /profile/skills non-array path.')
    (New-Case -Id 'Manage Skills Portfolio - 5' -Description 'Reject the save action when one or more submitted skill ids are invalid.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com' and open the Skills editor.`n2. Submit skill id list ['skill-react', 'skill-missing-999'] and click Save Skills.`n3. Observe the returned feedback after the save attempt." -Expected "1. The skills update is blocked because 'skill-missing-999' is not a valid skill id.`n2. The existing saved skill list remains unchanged after the failed update attempt." -Dependence 'The backend validates submitted skill ids against the master skills catalog.' -Note 'Trace: PUT /profile/skills invalid-id path.')
    (New-Case -Id 'Manage Skills Portfolio - 6' -Description 'Reject the save action when the submitted skill list is empty.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com'.`n2. Submit skillIds as an empty array [] through the skills update request.`n3. Observe the returned feedback after the save attempt." -Expected "1. The skills update is blocked because at least one skill is required by the endpoint.`n2. The existing saved skill list remains unchanged after the failed update attempt." -Dependence 'The backend endpoint requires at least one skill when processing the submitted skillIds array.' -Note 'Trace: PUT /profile/skills empty-array validation path.')
  ))
  (New-Section -Header 'Load Freelancer Dashboard (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Load Freelancer Dashboard - 1' -Description 'Load the freelancer dashboard successfully when projects and summary metrics already exist.' -Procedure "1. Sign in as freelancer account 'verified.user@gmail.com'.`n2. Open the Freelancer Dashboard from the navigation menu.`n3. Wait for the summary cards and work widgets to finish loading." -Expected "1. The Freelancer Dashboard loads summary cards, current work items, and metrics without authorization errors.`n2. The signed-in freelancer can review dashboard data on the protected page." -Dependence 'The account verified.user@gmail.com has Freelancer role and dashboard data already exists.' -Note 'Trace: FreelancerDashboardPage protected load.')
    (New-Case -Id 'Load Freelancer Dashboard - 2' -Description 'Load the freelancer dashboard successfully even when the account has no active projects yet.' -Procedure "1. Sign in as freelancer account 'new.freelancer@gmail.com'.`n2. Open the Freelancer Dashboard from the navigation menu.`n3. Wait for the page to finish loading." -Expected "1. The Freelancer Dashboard loads without crashing for 'new.freelancer@gmail.com'.`n2. The page shows an empty-state dashboard instead of failing when no project data exists." -Dependence 'The account new.freelancer@gmail.com has Freelancer role but currently has no active projects.' -Note 'Trace: Freelancer dashboard empty-state path.')
    (New-Case -Id 'Load Freelancer Dashboard - 3' -Description 'Block a non-freelancer account from opening the freelancer dashboard.' -Procedure "1. Sign in as client account 'lan.client.it02@gmail.com'.`n2. Try to open the Freelancer Dashboard directly.`n3. Observe the final route and rendered content." -Expected "1. The client account is not allowed to stay on the Freelancer Dashboard.`n2. The app redirects the user away from the freelancer-only page and does not render freelancer dashboard content." -Dependence 'The signed-in account has Client role and the target page is protected for Freelancer only.' -Note 'Trace: role protection for Freelancer dashboard.')
    (New-Case -Id 'Load Freelancer Dashboard - 4' -Description 'Show a not-found style failure when the signed-in freelancer record cannot be loaded from the backend.' -Procedure "1. Sign in with access token for freelancer id 'missing-freelancer'.`n2. Open the Freelancer Dashboard from the navigation menu.`n3. Observe the returned screen state after the dashboard request fails." -Expected "1. The dashboard request fails because the freelancer record cannot be found in the backend.`n2. The page shows a stable error or recovery state instead of rendering broken dashboard widgets." -Dependence 'The authenticated token is present but the corresponding freelancer user record cannot be loaded from the database.' -Note 'Trace: freelancer dashboard user-not-found path.')
  ))
)

$adminSections = @(
  (New-Section -Header 'Load Admin Analytics Overview (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Load Admin Analytics Overview - 1' -Description 'Load the default 30-day admin analytics overview successfully.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Admin Analytics dashboard without changing the date-range filter.`n3. Wait for the overview widgets to load." -Expected "1. The Admin Analytics dashboard loads the default 30-day overview successfully.`n2. The summary widgets and chart data are visible for the signed-in admin user." -Dependence 'The admin account admin27@interdev.local exists and has access to analytics data.' -Note 'Trace: GET /admin/dashboard/overview with default range.')
    (New-Case -Id 'Load Admin Analytics Overview - 2' -Description 'Load the 7-day admin analytics overview successfully.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Admin Analytics dashboard and select range '7 days'.`n3. Wait for the widgets to reload with the new filter." -Expected "1. The Admin Analytics dashboard reloads successfully for the 7-day range.`n2. The summary widgets and chart data reflect the selected 7-day filter." -Dependence 'The admin account admin27@interdev.local exists and the dashboard supports range filtering.' -Note 'Trace: GET /admin/dashboard/overview with 7d range.')
    (New-Case -Id 'Load Admin Analytics Overview - 3' -Description 'Load the admin analytics overview successfully when the range query is omitted and the controller defaults it to 30 days.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Admin Analytics dashboard through a request that omits the range query entirely.`n3. Wait for the overview widgets to load." -Expected "1. The Admin Analytics dashboard still loads successfully when the range query is omitted.`n2. The returned overview uses the default 30-day range." -Dependence 'The controller applies the default dashboard range when no explicit range query is provided.' -Note 'Trace: GET /admin/dashboard/overview default-range path.')
    (New-Case -Id 'Load Admin Analytics Overview - 4' -Description 'Normalize an unsupported range query to 30 days and still return analytics overview successfully.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Admin Analytics dashboard through request range '365d'.`n3. Wait for the overview widgets to load." -Expected "1. The Admin Analytics dashboard still loads successfully for unsupported range '365d'.`n2. The returned overview is normalized to the default 30-day range instead of failing immediately." -Dependence 'The controller normalizes unsupported dashboard ranges to 30d before calling the service.' -Note 'Trace: GET /admin/dashboard/overview unsupported-range normalization path.')
    (New-Case -Id 'Load Admin Analytics Overview - 5' -Description 'Show a stable error state when the analytics service is temporarily unavailable.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Admin Analytics dashboard while the analytics service returns 'Analytics cache unavailable'.`n3. Observe the loading state and the final feedback." -Expected "1. The dashboard shows a stable service-error state instead of rendering partial or broken analytics widgets.`n2. The page remains usable for retry after the temporary analytics outage." -Dependence 'The admin account is signed in and the analytics service is intentionally unavailable for this negative test.' -Note 'Trace: GET /admin/dashboard/overview service-unavailable path.')
    (New-Case -Id 'Load Admin Analytics Overview - 6' -Description 'Block a non-admin account from opening the admin analytics overview page.' -Procedure "1. Sign in as client account 'lan.client.it02@gmail.com'.`n2. Try to open the Admin Analytics dashboard directly.`n3. Observe the final route and rendered content." -Expected "1. The client account is not allowed to stay on the Admin Analytics dashboard.`n2. The app redirects the user away from the admin-only page and no analytics content is rendered." -Dependence 'The signed-in account has Client role and the target page is protected for Admin only.' -Note 'Trace: admin-route protection for analytics overview.')
  ))
  (New-Section -Header 'Change Analytics Range (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Change Analytics Range - 1' -Description 'Change the analytics filter from the default range to 7 days successfully.' -Procedure "1. Sign in as admin account 'admin27@interdev.local' and open the Admin Analytics dashboard.`n2. Select date range '7 days'.`n3. Wait for the overview widgets to refresh." -Expected "1. The analytics overview refreshes successfully for the 7-day filter.`n2. The displayed metrics and charts now reflect only the last 7 days of data." -Dependence 'The analytics dashboard is already loaded for the signed-in admin user.' -Note 'Trace: range selector -> GET /admin/dashboard/overview 7d.')
    (New-Case -Id 'Change Analytics Range - 2' -Description 'Change the analytics filter to 30 days successfully.' -Procedure "1. Sign in as admin account 'admin27@interdev.local' and open the Admin Analytics dashboard.`n2. Select date range '30 days'.`n3. Wait for the overview widgets to refresh." -Expected "1. The analytics overview refreshes successfully for the 30-day filter.`n2. The displayed metrics and charts now reflect the last 30 days of data." -Dependence 'The analytics dashboard is already loaded for the signed-in admin user.' -Note 'Trace: range selector -> GET /admin/dashboard/overview 30d.')
    (New-Case -Id 'Change Analytics Range - 3' -Description 'Change the analytics filter to 90 days successfully.' -Procedure "1. Sign in as admin account 'admin27@interdev.local' and open the Admin Analytics dashboard.`n2. Select date range '90 days'.`n3. Wait for the overview widgets to refresh." -Expected "1. The analytics overview refreshes successfully for the 90-day filter.`n2. The displayed metrics and charts now reflect the last 90 days of data." -Dependence 'The analytics dashboard is already loaded for the signed-in admin user.' -Note 'Trace: range selector -> GET /admin/dashboard/overview 90d.')
    (New-Case -Id 'Change Analytics Range - 4' -Description 'Keep the dashboard stable when the UI or request sends unsupported range value ''365d'' and the backend normalizes it to 30 days.' -Procedure "1. Sign in as admin account 'admin27@interdev.local' and open the Admin Analytics dashboard.`n2. Trigger an overview request with unsupported range value '365d'.`n3. Wait for the overview widgets to refresh." -Expected "1. The dashboard still refreshes successfully instead of crashing for unsupported range '365d'.`n2. The returned overview uses normalized range 30 days after the request completes." -Dependence 'The analytics controller normalizes unsupported range values to 30d.' -Note 'Trace: GET /admin/dashboard/overview unsupported-range normalization during range change.')
    (New-Case -Id 'Change Analytics Range - 5' -Description 'Show a stable error when the analytics query fails during a range change request.' -Procedure "1. Sign in as admin account 'admin27@interdev.local' and open the Admin Analytics dashboard.`n2. Select date range '90 days' while the analytics service returns 'dashboard query failed'.`n3. Observe the final dashboard state." -Expected "1. The dashboard shows a stable error state when the range-change query fails.`n2. The page remains usable for another retry instead of freezing or rendering corrupted widgets." -Dependence 'The analytics range-change request reaches the backend, but the service throws a repository failure.' -Note 'Trace: GET /admin/dashboard/overview unexpected failure during range change.')
  ))
  (New-Section -Header 'List Wizard Question Configuration (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'List Wizard Question Configuration - 1' -Description 'Load the wizard-question configuration list successfully for an admin user.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Wizard Questions Management page.`n3. Wait for the configuration table to load." -Expected "1. The Wizard Questions Management page loads the configuration list successfully.`n2. The table shows question code, label, option count, and action buttons for each loaded item." -Dependence 'The admin account admin27@interdev.local exists and one or more wizard questions are configured.' -Note 'Trace: AdminWizardQuestionsPage -> getAllQuestionsForAdmin.')
    (New-Case -Id 'List Wizard Question Configuration - 2' -Description 'Render a stable empty-list state when the wizard-question configuration currently has no records.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Wizard Questions Management page against an empty configuration dataset.`n3. Wait for the table area to finish loading." -Expected "1. The Wizard Questions Management page shows a stable empty-list state when no wizard questions exist.`n2. The page stays usable and does not render broken table rows." -Dependence 'The admin account is signed in and the wizard-question dataset is empty for this test environment.' -Note 'Trace: AdminWizardQuestionsPage empty-list path.')
    (New-Case -Id 'List Wizard Question Configuration - 3' -Description 'Show the correct option count values for loaded wizard questions.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Wizard Questions Management page and locate question code 'Q_PROJECT_TYPE'.`n3. Review the value displayed in the Options column." -Expected "1. The Options column shows the correct number of configured options for question 'Q_PROJECT_TYPE'.`n2. The page keeps the table stable while loading option counts." -Dependence 'Question code Q_PROJECT_TYPE exists in the wizard-question configuration list.' -Note 'Trace: AdminWizardQuestionsPage table render for option counts.')
    (New-Case -Id 'List Wizard Question Configuration - 4' -Description 'Show a stable error toast when the wizard-question list cannot be loaded.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Wizard Questions Management page while the wizard-question API is unavailable.`n3. Observe the loading state and the feedback message." -Expected "1. The page stops the loading spinner and shows a clear error message when the wizard-question list cannot be loaded.`n2. The screen stays stable instead of crashing when the API request fails." -Dependence 'The admin account is signed in and the wizard-question API is intentionally unavailable for this negative test.' -Note 'Trace: AdminWizardQuestionsPage handles getAllQuestionsForAdmin failure.')
  ))
  (New-Section -Header 'View Wizard Question Detail (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'View Wizard Question Detail - 1' -Description 'Open the detail modal successfully for an existing wizard question.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Wizard Questions Management page and click View for question code 'Q_PROJECT_TYPE'.`n3. Wait for the detail modal to load." -Expected "1. The detail modal opens successfully for question 'Q_PROJECT_TYPE'.`n2. The modal shows code, label, help text, and the configured options." -Dependence 'Question code Q_PROJECT_TYPE exists and the admin account is signed in.' -Note 'Trace: getQuestionDetailForAdmin -> detail modal.')
    (New-Case -Id 'View Wizard Question Detail - 2' -Description 'Open the detail modal successfully for a question that contains multiple option values.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Wizard Questions Management page and click View for question code 'Q_BUDGET_RANGE'.`n3. Review the list of configured options inside the modal." -Expected "1. The detail modal opens successfully for question 'Q_BUDGET_RANGE'.`n2. The modal lists all configured option labels and values for the selected question." -Dependence 'Question code Q_BUDGET_RANGE exists with multiple configured options.' -Note 'Trace: detail modal renders multi-option question.')
    (New-Case -Id 'View Wizard Question Detail - 3' -Description 'Open the detail modal successfully after the admin refreshes the configuration list and re-selects the same question.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Wizard Questions Management page, refresh the list, then click View for question code 'Q_PROJECT_TYPE' again.`n3. Wait for the detail modal to load." -Expected "1. The detail modal still opens successfully after the list refresh for question 'Q_PROJECT_TYPE'.`n2. The refreshed detail request shows the current code, label, help text, and configured options." -Dependence 'Question code Q_PROJECT_TYPE exists and remains available after the configuration list refresh.' -Note 'Trace: repeated getQuestionDetailForAdmin success path.')
    (New-Case -Id 'View Wizard Question Detail - 4' -Description 'Show a stable error toast when the selected wizard question no longer exists.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the Wizard Questions Management page and try to load a removed question id '9999'.`n3. Observe the feedback message." -Expected "1. The detail modal does not open for the missing question id '9999'.`n2. The page shows a clear error toast instead of rendering broken detail content." -Dependence 'The selected question id 9999 does not exist anymore.' -Note 'Trace: getQuestionDetailForAdmin negative path.')
  ))
  (New-Section -Header 'Create Wizard Question (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Create Wizard Question - 1' -Description 'Create a new wizard question successfully with a valid code, label, help text, and options.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the wizard-question create flow and enter code 'Q_NEW_STACK', label 'What tech stack do you need?', help text 'Select the main stack for this request.', and options 'ReactJS', 'Node.js', and 'Python'.`n3. Save the new question and return to the list." -Expected "1. The create action succeeds and adds question code 'Q_NEW_STACK' to the wizard-question configuration list.`n2. The newly created question appears with the configured options after the list refreshes." -Dependence 'The admin account is allowed to create configuration records and code Q_NEW_STACK does not already exist.' -Note 'Trace: create wizard question flow -> createWizardQuestion.')
    (New-Case -Id 'Create Wizard Question - 2' -Description 'Reject wizard-question creation when one option is missing a label or value.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the wizard-question create flow and enter code 'Q_INVALID_OPTION', label 'Select invalid option sample', and add one option with value 'react' but leave the label blank.`n3. Click Save Changes and observe the validation feedback." -Expected "1. The create action is blocked because every option must contain both a value and a label.`n2. No new question is added for code 'Q_INVALID_OPTION'." -Dependence 'The create flow validates option fields before a successful save is allowed.' -Note 'Trace: edit modal option validation before createWizardQuestion.')
    (New-Case -Id 'Create Wizard Question - 3' -Description 'Reject wizard-question creation when the submitted code already exists.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the wizard-question create flow and enter existing code 'Q_PROJECT_TYPE' with label 'Duplicate code test' and one valid option.`n3. Click Save Changes and review the returned error message." -Expected "1. The create action fails because code 'Q_PROJECT_TYPE' already exists in the configuration set.`n2. No duplicate wizard question is created for the existing code." -Dependence 'Question code Q_PROJECT_TYPE already exists in the current wizard-question configuration.' -Note 'Trace: createWizardQuestion duplicate-code path.')
    (New-Case -Id 'Create Wizard Question - 4' -Description 'Reject wizard-question creation when the question label is left empty.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the wizard-question create flow and enter code 'Q_EMPTY_LABEL', leave the label empty, add one valid option 'ReactJS', then click Save Changes.`n3. Observe the validation feedback." -Expected "1. The create action is blocked because the question label is required.`n2. No new question is added for code 'Q_EMPTY_LABEL'." -Dependence 'The create flow validates required fields such as question label before saving.' -Note 'Trace: create wizard question validation for empty label.')
    (New-Case -Id 'Create Wizard Question - 5' -Description 'Reject wizard-question creation when the question code is left empty.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open the wizard-question create flow and leave the code field empty, enter label 'Need a code', add one valid option 'ReactJS', then click Save Changes.`n3. Observe the validation feedback." -Expected "1. The create action is blocked because question code is required.`n2. No new wizard question is added when the code field is empty." -Dependence 'The create flow validates required fields such as question code before saving.' -Note 'Trace: create wizard question validation for empty code.')
  ))
  (New-Section -Header 'Update Wizard Question (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)' -Cases @(
    (New-Case -Id 'Update Wizard Question - 1' -Description 'Update the label and help text of an existing wizard question successfully.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open Edit for question code 'Q_PROJECT_TYPE', change the label to 'What project type do you need?' and help text to 'Choose the project type that best matches this request.', then click Save Changes.`n3. Wait for the list to refresh." -Expected "1. The update action succeeds and stores the new label and help text for 'Q_PROJECT_TYPE'.`n2. The refreshed list and detail view show the updated values." -Dependence 'Question code Q_PROJECT_TYPE exists and can be edited by the admin user.' -Note 'Trace: updateWizardQuestion label/helpText path.')
    (New-Case -Id 'Update Wizard Question - 2' -Description 'Update the option labels and values of an existing wizard question successfully.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open Edit for question code 'Q_BUDGET_RANGE', change option label 'Small' to 'Startup Budget' and option value 'small' to 'startup-budget', then click Save Changes.`n3. Wait for the list to refresh and reopen the detail view." -Expected "1. The update action succeeds and stores the edited option label and value for 'Q_BUDGET_RANGE'.`n2. The refreshed detail view shows 'Startup Budget' and 'startup-budget' in the option list." -Dependence 'Question code Q_BUDGET_RANGE exists with editable options.' -Note 'Trace: updateWizardQuestion options path.')
    (New-Case -Id 'Update Wizard Question - 3' -Description 'Reject wizard-question update when one edited option is left incomplete.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open Edit for question code 'Q_BUDGET_RANGE', clear the label field of one option so it becomes empty, then click Save Changes.`n3. Observe the validation feedback in the edit modal." -Expected "1. The update action is blocked because one option is missing the required label text.`n2. The existing wizard-question data remains unchanged after the failed update attempt." -Dependence 'The edit modal validates option label and value fields before a successful update is allowed.' -Note 'Trace: edit modal validation before updateWizardQuestion.')
    (New-Case -Id 'Update Wizard Question - 4' -Description 'Remove one old option successfully while keeping the remaining valid options of the same question.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open Edit for question code 'Q_BUDGET_RANGE', remove option 'Legacy Budget Tier', keep the remaining options valid, then click Save Changes.`n3. Wait for the list to refresh and reopen the detail view." -Expected "1. The update action succeeds and the removed option no longer appears in the refreshed detail view.`n2. The remaining valid options stay available for question 'Q_BUDGET_RANGE'." -Dependence 'Question code Q_BUDGET_RANGE exists with removable options and the update flow supports deleting options during save.' -Note 'Trace: updateWizardQuestion option-removal path.')
    (New-Case -Id 'Update Wizard Question - 5' -Description 'Reject wizard-question update when the admin clears the question code of an existing record.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open Edit for question code 'Q_PROJECT_TYPE', remove all text from the code field so it becomes empty, then click Save Changes.`n3. Observe the validation feedback in the edit modal." -Expected "1. The update action is blocked because question code is required.`n2. The existing wizard-question data remains unchanged after the failed update attempt." -Dependence 'The edit flow validates required fields such as question code before saving.' -Note 'Trace: update wizard question validation for empty code.')
    (New-Case -Id 'Update Wizard Question - 6' -Description 'Show a stable error toast when the selected wizard question no longer exists during the update save.' -Procedure "1. Sign in as admin account 'admin27@interdev.local'.`n2. Open Edit for question id '9999', enter label 'Missing question update', then click Save Changes.`n3. Observe the returned feedback in the edit modal." -Expected "1. The update action fails because the selected wizard question no longer exists.`n2. The page shows a clear error message and does not save any partial update." -Dependence 'Question id 9999 does not exist at the moment the update request is submitted.' -Note 'Trace: updateWizardQuestion not-found path.')
  ))
)

if (-not (Test-Path -LiteralPath $WorkbookPath)) {
  throw "Workbook not found: $WorkbookPath"
}

New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$tempWorkbook = Join-Path $workDir 'workbook.xlsx'
Copy-FileSharedRead -SourcePath $WorkbookPath -DestinationPath $tempWorkbook
[System.IO.Compression.ZipFile]::ExtractToDirectory($tempWorkbook, $extractDir)

try {
  $sheet2 = Join-Path $extractDir 'xl\worksheets\sheet2.xml'
  $sheet3 = Join-Path $extractDir 'xl\worksheets\sheet3.xml'
  $sheet4 = Join-Path $extractDir 'xl\worksheets\sheet4.xml'
  $sheet5 = Join-Path $extractDir 'xl\worksheets\sheet5.xml'
  $sheet6 = Join-Path $extractDir 'xl\worksheets\sheet6.xml'
  $sheet7 = Join-Path $extractDir 'xl\worksheets\sheet7.xml'

  Update-TestCaseList -SheetPath $sheet2

  $authCount = Write-FeatureSheet -SheetPath $sheet3 -Sections $authSections -Tester $tester -Today $today
  $kycCount = Write-FeatureSheet -SheetPath $sheet4 -Sections $kycSections -Tester $tester -Today $today
  $userCount = Write-FeatureSheet -SheetPath $sheet5 -Sections $userSections -Tester $tester -Today $today
  $adminCount = Write-FeatureSheet -SheetPath $sheet7 -Sections $adminSections -Tester $tester -Today $today

  Update-TestReport -SheetPath $sheet6 -AuthCount $authCount -KycCount $kycCount -UserCount $userCount -AdminCount $adminCount

  Remove-Item -LiteralPath $WorkbookPath -Force
  [System.IO.Compression.ZipFile]::CreateFromDirectory($extractDir, $WorkbookPath)
}
finally {
  if (Test-Path -LiteralPath $workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force }
}

Write-Output "Updated integration workbook: $WorkbookPath"
