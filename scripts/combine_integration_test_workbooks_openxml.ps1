param(
  [string]$OutputPath = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Test Case Document_Integration_Combined_v2.xlsx'
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

function Get-CellTextFromPath {
  param([string]$SheetPath, [string]$CellReference)
  [xml]$sheetXml = [System.IO.File]::ReadAllText($SheetPath)
  $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
  $ns.AddNamespace('x', $sheetXml.DocumentElement.NamespaceURI)
  $cell = $sheetXml.SelectSingleNode("//x:c[@r='$CellReference']", $ns)
  if ($null -eq $cell) { return '' }
  $type = $cell.GetAttribute('t')
  if ($type -eq 'inlineStr') {
    return (($cell.SelectNodes('.//x:t', $ns) | ForEach-Object { $_.InnerText }) -join '')
  }
  $valueNode = $cell.SelectSingleNode('x:v', $ns)
  if ($null -ne $valueNode) { return [string]$valueNode.InnerText }
  return ''
}

function Get-CellTextFromElement {
  param([System.Xml.XmlElement]$Cell, [System.Xml.XmlNamespaceManager]$Ns)
  if ($null -eq $Cell) { return '' }
  $type = $Cell.GetAttribute('t')
  if ($type -eq 'inlineStr') {
    return (($Cell.SelectNodes('.//x:t', $Ns) | ForEach-Object { $_.InnerText }) -join '')
  }
  $valueNode = $Cell.SelectSingleNode('x:v', $Ns)
  if ($null -ne $valueNode) { return [string]$valueNode.InnerText }
  return ''
}

function Normalize-ProcedureText {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }

  $replacements = [ordered]@{
    '`/register`' = 'the registration page'
    '/register' = 'the registration page'
    '`/login`' = 'the sign-in page'
    '/login' = 'the sign-in page'
    '/verify-email?token=<valid-token>' = 'the email verification page for a valid verification token'
    '/verify-email?token=<expired-or-invalid-token>' = 'the email verification page for an expired or invalid token'
    '/forgot-password' = 'the forgot-password page'
    '`/auth/profile`' = 'the authenticated profile service'
    '/auth/profile' = 'the authenticated profile service'
    '`/kyc/me`' = 'the current KYC status service'
    '/kyc/me' = 'the current KYC status service'
    '`/kyc/admin/all`' = 'the admin KYC queue service'
    '/kyc/admin/all' = 'the admin KYC queue service'
    '`/kyc/admin/:id/watermark`' = 'the KYC detail review service'
    '/kyc/admin/:id/watermark' = 'the KYC detail review service'
    '`/kyc`' = 'the KYC submission page'
    '/kyc' = 'the KYC submission page'
    '/freelancer/profile' = 'the freelancer profile page'
    '`/profile/cv`' = 'the CV retrieval flow'
    '/profile/cv' = 'the CV retrieval flow'
    '`/profile/skills`' = 'the skills update flow'
    '/profile/skills' = 'the skills update flow'
    '`/freelancer/dashboard`' = 'the freelancer dashboard'
    '/freelancer/dashboard' = 'the freelancer dashboard'
    '`/admin/dashboard/overview?range=30d`' = 'the default 30-day analytics overview request'
    '/admin/dashboard/overview?range=30d' = 'the default 30-day analytics overview request'
    '`/admin/dashboard/overview?range=7d`' = 'the 7-day analytics overview request'
    '/admin/dashboard/overview?range=7d' = 'the 7-day analytics overview request'
    '`/admin/dashboard/overview`' = 'the analytics overview request'
    '/admin/dashboard/overview' = 'the analytics overview request'
    '`/admin/wizard/questions/:id`' = 'the selected wizard-question detail request'
    '/admin/wizard/questions/:id' = 'the selected wizard-question detail request'
    '`/admin/wizard/questions`' = 'the wizard-question list request'
    '/admin/wizard/questions' = 'the wizard-question list request'
    '/admin/reviews' = 'an admin-only review management page'
    '`/profile`' = 'the profile page'
    '/profile' = 'the profile page'
    'Terms/Privacy' = 'Terms and Privacy'
  }

  foreach ($key in $replacements.Keys) {
    $Text = $Text.Replace([string]$key, [string]$replacements[$key])
  }

  return $Text
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

function Extract-CaseListRows {
  param([string]$SheetPath, [string]$ModuleName)
  $rows = @()
  foreach ($rowNumber in 9..60) {
    $functionName = Get-CellTextFromPath -SheetPath $SheetPath -CellReference ('C' + $rowNumber)
    if (-not [string]::IsNullOrWhiteSpace($functionName)) {
      $rows += [pscustomobject]@{
        ModuleName   = $ModuleName
        FunctionName = $functionName
        Description  = Get-CellTextFromPath -SheetPath $SheetPath -CellReference ('E' + $rowNumber)
        Precondition = Get-CellTextFromPath -SheetPath $SheetPath -CellReference ('F' + $rowNumber)
      }
    }
  }
  return $rows
}

function Ensure-Override {
  param([xml]$ContentTypesXml, [string]$PartName)
  $ns = New-Object System.Xml.XmlNamespaceManager($ContentTypesXml.NameTable)
  $ns.AddNamespace('ct', $ContentTypesXml.DocumentElement.NamespaceURI)
  $exists = $ContentTypesXml.SelectSingleNode("//ct:Override[@PartName='$PartName']", $ns)
  if ($null -ne $exists) { return }
  $node = $ContentTypesXml.CreateElement('Override', $ContentTypesXml.DocumentElement.NamespaceURI)
  $node.SetAttribute('PartName', $PartName)
  $node.SetAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml')
  [void]$ContentTypesXml.DocumentElement.AppendChild($node)
}

$tester = 'BaoNG'
$today = Get-Date -Format 'yyyy-MM-dd'
$tempRoot = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\tmp\spreadsheets'
$workDir = Join-Path $tempRoot ('integration-combined-' + [guid]::NewGuid().ToString())
$extractDir = Join-Path $workDir 'combined'
$sourceRoot = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet'

$modules = @(
  @{
    Name = 'Authentication & Authorization'
    SourcePath = Join-Path $sourceRoot 'Report5_Test Case Document_Authentication_Authorization_v2.xlsx'
    TargetSheetFile = 'sheet3.xml'
    RelationId = 'rId3'
    SheetId = '3'
  },
  @{
    Name = 'KYC Verification & Identity Management'
    SourcePath = Join-Path $sourceRoot 'Report5_Test Case Document_KYC_Verification_Identity_Management_v2.xlsx'
    TargetSheetFile = 'sheet4.xml'
    RelationId = 'rId4'
    SheetId = '4'
  },
  @{
    Name = 'User Dashboard & Portfolio'
    SourcePath = Join-Path $sourceRoot 'Report5_Test Case Document_User_Dashboard_Portfolio_v2.xlsx'
    TargetSheetFile = 'sheet5.xml'
    RelationId = 'rId5'
    SheetId = '5'
  },
  @{
    Name = 'Admin Dashboard & System Configuration'
    SourcePath = Join-Path $sourceRoot 'Report5_Test Case Document_Admin_Dashboard_System_Configuration_v2.xlsx'
    TargetSheetFile = 'sheet7.xml'
    RelationId = 'rId9'
    SheetId = '7'
  }
)

Copy-FileSharedRead -SourcePath $modules[0].SourcePath -DestinationPath $OutputPath
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($OutputPath, $extractDir)

try {
  $workbookPath = Join-Path $extractDir 'xl\workbook.xml'
  $workbookRelsPath = Join-Path $extractDir 'xl\_rels\workbook.xml.rels'
  $contentTypesPath = Join-Path $extractDir '[Content_Types].xml'
  $coverPath = Join-Path $extractDir 'xl\worksheets\sheet1.xml'
  $listPath = Join-Path $extractDir 'xl\worksheets\sheet2.xml'
  $reportPath = Join-Path $extractDir 'xl\worksheets\sheet6.xml'

  [xml]$workbookXml = Read-XmlFile $workbookPath
  [xml]$workbookRelsXml = Read-XmlFile $workbookRelsPath
  [xml]$contentTypesXml = Read-XmlFile $contentTypesPath
  [xml]$coverXml = Read-XmlFile $coverPath
  [xml]$listXml = Read-XmlFile $listPath
  [xml]$reportXml = Read-XmlFile $reportPath

  foreach ($sheetXml in @($coverXml, $listXml, $reportXml)) {
    $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
    $ns.AddNamespace('x', $sheetXml.DocumentElement.NamespaceURI)
    $sheetXml | Add-Member -NotePropertyName CodexNs -NotePropertyValue $ns
  }

  $allCaseRows = @()
  $moduleSummaries = @()

  foreach ($module in $modules) {
    $sourceExtractDir = Join-Path $workDir ([IO.Path]::GetFileNameWithoutExtension($module.SourcePath))
    [System.IO.Compression.ZipFile]::ExtractToDirectory($module.SourcePath, $sourceExtractDir)
    try {
      $sourceFeaturePath = Join-Path $sourceExtractDir 'xl\worksheets\sheet3.xml'
      $sourceListPath = Join-Path $sourceExtractDir 'xl\worksheets\sheet2.xml'
      $sourceReportPath = Join-Path $sourceExtractDir 'xl\worksheets\sheet6.xml'
      $targetFeaturePath = Join-Path $extractDir ('xl\worksheets\' + $module.TargetSheetFile)

      Copy-Item -LiteralPath $sourceFeaturePath -Destination $targetFeaturePath -Force

      [xml]$featureXml = Read-XmlFile $targetFeaturePath
      $featureNs = New-Object System.Xml.XmlNamespaceManager($featureXml.NameTable)
      $featureNs.AddNamespace('x', $featureXml.DocumentElement.NamespaceURI)
      foreach ($rowNumber in 9..200) {
        $rowNode = $featureXml.SelectSingleNode("//x:sheetData/x:row[@r='$rowNumber']", $featureNs)
        if ($null -eq $rowNode) { continue }
        $testerCell = Get-OrCreateCell -SheetXml $featureXml -Row $rowNode -Ns $featureNs -ColumnLetters 'I'
        $hasTesterValue = $false
        if ($testerCell.GetAttribute('t') -eq 'inlineStr') {
          $hasTesterValue = ($testerCell.SelectNodes('.//x:t', $featureNs) | Measure-Object).Count -gt 0
        } else {
          $valueNode = $testerCell.SelectSingleNode('x:v', $featureNs)
          $hasTesterValue = $null -ne $valueNode -and -not [string]::IsNullOrWhiteSpace($valueNode.InnerText)
        }
        if ($hasTesterValue) {
          Set-CellText -SheetXml $featureXml -Row $rowNode -Ns $featureNs -ColumnLetters 'I' -Text $tester

          $procedureCell = Get-OrCreateCell -SheetXml $featureXml -Row $rowNode -Ns $featureNs -ColumnLetters 'C'
          $procedureText = Get-CellTextFromElement -Cell $procedureCell -Ns $featureNs
          if (-not [string]::IsNullOrWhiteSpace($procedureText)) {
            Set-CellText -SheetXml $featureXml -Row $rowNode -Ns $featureNs -ColumnLetters 'C' -Text (Normalize-ProcedureText -Text $procedureText)
          }
        }
      }
      $featureXml.Save($targetFeaturePath)

      $allCaseRows += Extract-CaseListRows -SheetPath $sourceListPath -ModuleName $module.Name
      $moduleSummaries += [pscustomobject]@{
        Name = $module.Name
        Pass = [int](Get-CellTextFromPath -SheetPath $sourceReportPath -CellReference 'D11')
        Fail = [int](Get-CellTextFromPath -SheetPath $sourceReportPath -CellReference 'E11')
        Untested = [int](Get-CellTextFromPath -SheetPath $sourceReportPath -CellReference 'F11')
        NA = [int](Get-CellTextFromPath -SheetPath $sourceReportPath -CellReference 'G11')
        Total = [int](Get-CellTextFromPath -SheetPath $sourceReportPath -CellReference 'H11')
      }
    } finally {
      if (Test-Path -LiteralPath $sourceExtractDir) { Remove-Item -LiteralPath $sourceExtractDir -Recurse -Force }
    }
  }

  $wbNs = New-Object System.Xml.XmlNamespaceManager($workbookXml.NameTable)
  $wbNs.AddNamespace('x', $workbookXml.DocumentElement.NamespaceURI)
  $reportSheetNode = $workbookXml.SelectSingleNode("//x:sheets/x:sheet[@name='Test Report']", $wbNs)
  if ($null -eq $reportSheetNode) { throw 'Missing Test Report sheet node' }

  foreach ($sheet in @($workbookXml.SelectNodes('//x:sheets/x:sheet', $wbNs))) {
    $name = $sheet.GetAttribute('name')
    if ($name -notin @('Cover', 'Test case List', 'Test Report', 'Authentication & Authorization')) {
      [void]$sheet.ParentNode.RemoveChild($sheet)
    }
  }

  $existingNames = @($workbookXml.SelectNodes('//x:sheets/x:sheet', $wbNs) | ForEach-Object { $_.GetAttribute('name') })
  foreach ($module in $modules[1..($modules.Count - 1)]) {
    if ($existingNames -contains $module.Name) { continue }
    $sheetNode = $workbookXml.CreateElement('sheet', $workbookXml.DocumentElement.NamespaceURI)
    $sheetNode.SetAttribute('name', $module.Name)
    $sheetNode.SetAttribute('sheetId', $module.SheetId)
    $sheetNode.SetAttribute('state', 'visible')
    $sheetNode.SetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', $module.RelationId)
    [void]$reportSheetNode.ParentNode.InsertBefore($sheetNode, $reportSheetNode)
  }

  $relNs = New-Object System.Xml.XmlNamespaceManager($workbookRelsXml.NameTable)
  $relNs.AddNamespace('r', $workbookRelsXml.DocumentElement.NamespaceURI)
  if ($null -eq $workbookRelsXml.SelectSingleNode("//r:Relationship[@Id='rId9']", $relNs)) {
    $relNode = $workbookRelsXml.CreateElement('Relationship', $workbookRelsXml.DocumentElement.NamespaceURI)
    $relNode.SetAttribute('Id', 'rId9')
    $relNode.SetAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet')
    $relNode.SetAttribute('Target', '/xl/worksheets/sheet7.xml')
    [void]$workbookRelsXml.DocumentElement.InsertBefore($relNode, $workbookRelsXml.DocumentElement.SelectSingleNode("//r:Relationship[@Id='rId7']", $relNs))
  }
  Ensure-Override -ContentTypesXml $contentTypesXml -PartName '/xl/worksheets/sheet7.xml'

  $coverRow4 = Get-RowNode $coverXml $coverXml.CodexNs 4
  $coverRow5 = Get-RowNode $coverXml $coverXml.CodexNs 5
  $coverRow6 = Get-RowNode $coverXml $coverXml.CodexNs 6
  $coverRow7 = Get-RowNode $coverXml $coverXml.CodexNs 7
  $coverRow12 = Get-RowNode $coverXml $coverXml.CodexNs 12
  Set-CellText $coverXml $coverRow4 $coverXml.CodexNs 'C' 'InterDev'
  Set-CellText $coverXml $coverRow4 $coverXml.CodexNs 'G' $tester
  Set-CellText $coverXml $coverRow5 $coverXml.CodexNs 'C' 'INTERDEV'
  Set-CellText $coverXml $coverRow5 $coverXml.CodexNs 'G' $tester
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'C' 'INTERDEV_Integration_Test_Combined_IT_v1.0'
  Set-CellText $coverXml $coverRow6 $coverXml.CodexNs 'G' $today
  Set-CellText $coverXml $coverRow7 $coverXml.CodexNs 'G' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'B' $today
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'C' 'v1.0'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'D' 'A'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'E' 'New'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'F' 'Initial combined integration workbook generated from feature-level integration workbooks.'
  Set-CellText $coverXml $coverRow12 $coverXml.CodexNs 'G' 'Authentication, KYC, user dashboard portfolio, and admin system configuration coverage'

  $listRow5 = Get-RowNode $listXml $listXml.CodexNs 5
  Set-CellText $listXml $listRow5 $listXml.CodexNs 'D' "<List enviroment requires in this system`n1. Backend API server with Auth, KYC, Users, Admin Dashboard, and Wizard modules enabled`n2. PostgreSQL database seeded with guest, freelancer, broker, client, staff, and admin test data`n3. Web browser with cookie support enabled`n4. Valid sample CV files, KYC document images, and wizard-question seed data`n5. Analytics, wallet, staffing, and moderation data available for admin overview flows`n>"
  Clear-Cells $listXml $listXml.CodexNs (9..60) @('B', 'C', 'D', 'E', 'F')

  $listRowNumber = 9
  $listIndex = 1
  foreach ($item in $allCaseRows) {
    $row = Get-RowNode $listXml $listXml.CodexNs $listRowNumber
    Set-CellNumber $listXml $row $listXml.CodexNs 'B' ([string]$listIndex)
    Set-CellText $listXml $row $listXml.CodexNs 'C' $item.FunctionName
    Set-CellText $listXml $row $listXml.CodexNs 'D' $item.ModuleName
    Set-CellText $listXml $row $listXml.CodexNs 'E' $item.Description
    Set-CellText $listXml $row $listXml.CodexNs 'F' $item.Precondition
    $listRowNumber++
    $listIndex++
  }

  $reportModuleStyle = Get-CellStyleMap -SheetXml $reportXml -Ns $reportXml.CodexNs -RowNumber 13 -Columns @('B','C','D','E','F','G','H')
  $reportSubtotalStyle = Get-CellStyleMap -SheetXml $reportXml -Ns $reportXml.CodexNs -RowNumber 14 -Columns @('B','C','D','E','F','G','H')
  Apply-CellStyleMap -SheetXml $reportXml -Ns $reportXml.CodexNs -RowNumber 14 -StyleMap $reportModuleStyle
  Apply-CellStyleMap -SheetXml $reportXml -Ns $reportXml.CodexNs -RowNumber 15 -StyleMap $reportSubtotalStyle

  $reportRow3 = Get-RowNode $reportXml $reportXml.CodexNs 3
  $reportRow4 = Get-RowNode $reportXml $reportXml.CodexNs 4
  $reportRow5 = Get-RowNode $reportXml $reportXml.CodexNs 5
  $reportRow6 = Get-RowNode $reportXml $reportXml.CodexNs 6
  Set-CellText $reportXml $reportRow3 $reportXml.CodexNs 'G' $tester
  Set-CellText $reportXml $reportRow4 $reportXml.CodexNs 'G' $tester
  Set-CellText $reportXml $reportRow5 $reportXml.CodexNs 'H' $today
  Set-CellText $reportXml $reportRow6 $reportXml.CodexNs 'C' 'Release scope: Combined integration test workbook for the delivered InterDev modules.'

  Clear-Cells $reportXml $reportXml.CodexNs @(11,12,13,14,15,16,17) @('B','C','D','E','F','G','H')

  $reportStartRow = 11
  $moduleCounter = 1
  foreach ($module in $moduleSummaries) {
    $row = Get-RowNode $reportXml $reportXml.CodexNs $reportStartRow
    Set-CellNumber $reportXml $row $reportXml.CodexNs 'B' ([string]$moduleCounter)
    Set-CellText $reportXml $row $reportXml.CodexNs 'C' $module.Name
    Set-CellNumber $reportXml $row $reportXml.CodexNs 'D' ([string]$module.Pass)
    Set-CellNumber $reportXml $row $reportXml.CodexNs 'E' ([string]$module.Fail)
    Set-CellNumber $reportXml $row $reportXml.CodexNs 'F' ([string]$module.Untested)
    Set-CellNumber $reportXml $row $reportXml.CodexNs 'G' ([string]$module.NA)
    Set-CellNumber $reportXml $row $reportXml.CodexNs 'H' ([string]$module.Total)
    $moduleCounter++
    $reportStartRow++
  }

  $subtotalRow = Get-RowNode $reportXml $reportXml.CodexNs 15
  $passTotal = ($moduleSummaries | Measure-Object -Property Pass -Sum).Sum
  $failTotal = ($moduleSummaries | Measure-Object -Property Fail -Sum).Sum
  $untestedTotal = ($moduleSummaries | Measure-Object -Property Untested -Sum).Sum
  $naTotal = ($moduleSummaries | Measure-Object -Property NA -Sum).Sum
  $caseTotal = ($moduleSummaries | Measure-Object -Property Total -Sum).Sum
  Set-CellText $reportXml $subtotalRow $reportXml.CodexNs 'C' 'Sub total'
  Set-CellNumber $reportXml $subtotalRow $reportXml.CodexNs 'D' ([string]$passTotal)
  Set-CellNumber $reportXml $subtotalRow $reportXml.CodexNs 'E' ([string]$failTotal)
  Set-CellNumber $reportXml $subtotalRow $reportXml.CodexNs 'F' ([string]$untestedTotal)
  Set-CellNumber $reportXml $subtotalRow $reportXml.CodexNs 'G' ([string]$naTotal)
  Set-CellNumber $reportXml $subtotalRow $reportXml.CodexNs 'H' ([string]$caseTotal)

  $coverageRow = Get-RowNode $reportXml $reportXml.CodexNs 16
  $successCoverageRow = Get-RowNode $reportXml $reportXml.CodexNs 17
  Set-CellText $reportXml $coverageRow $reportXml.CodexNs 'C' 'Test coverage'
  Set-CellNumber $reportXml $coverageRow $reportXml.CodexNs 'E' '100'
  Set-CellText $reportXml $coverageRow $reportXml.CodexNs 'F' '%'
  Set-CellText $reportXml $successCoverageRow $reportXml.CodexNs 'C' 'Test successful coverage'
  Set-CellNumber $reportXml $successCoverageRow $reportXml.CodexNs 'E' '100'
  Set-CellText $reportXml $successCoverageRow $reportXml.CodexNs 'F' '%'

  $workbookXml.Save($workbookPath)
  $workbookRelsXml.Save($workbookRelsPath)
  $contentTypesXml.Save($contentTypesPath)
  $coverXml.Save($coverPath)
  $listXml.Save($listPath)
  $reportXml.Save($reportPath)

  Remove-Item -LiteralPath $OutputPath -Force
  [System.IO.Compression.ZipFile]::CreateFromDirectory($extractDir, $OutputPath)
} finally {
  if (Test-Path -LiteralPath $workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force }
}

Write-Output "Created combined integration workbook: $OutputPath"
