param(
    [string]$WorkbookPath = "C:\Users\ASUS\Desktop\InterDev\SEP492-Project\Unit Test (1).xlsx"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-SharedStringText {
    param([System.Xml.XmlElement]$Si)

    if ($Si.t) {
        return [string]$Si.t
    }

    if ($Si.r) {
        $text = ""
        foreach ($run in $Si.r) {
            if ($run.t -is [string]) {
                $text += $run.t
            } elseif ($run.t.'#text') {
                $text += $run.t.'#text'
            }
        }
        return $text
    }

    return ""
}

function Convert-ColumnNameToNumber {
    param([string]$ColumnName)

    $number = 0
    foreach ($char in $ColumnName.ToCharArray()) {
        $number = ($number * 26) + ([int][char]$char - [int][char]'A' + 1)
    }
    return $number
}

function Get-OrCreate-Row {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlNamespaceManager]$SheetNs,
        [int]$RowNumber
    )

    $row = $SheetXml.SelectSingleNode("//x:sheetData/x:row[@r='$RowNumber']", $SheetNs)
    if ($row) {
        return $row
    }

    $sheetData = $SheetXml.SelectSingleNode("//x:sheetData", $SheetNs)
    $row = $SheetXml.CreateElement("row", $SheetXml.DocumentElement.NamespaceURI)
    $row.SetAttribute("r", [string]$RowNumber)
    [void]$sheetData.AppendChild($row)
    return $row
}

function Get-OrCreate-Cell {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlNamespaceManager]$SheetNs,
        [string]$CellRef
    )

    $cell = $SheetXml.SelectSingleNode("//x:c[@r='$CellRef']", $SheetNs)
    if ($cell) {
        return $cell
    }

    $rowNumber = [int]([regex]::Match($CellRef, "\d+").Value)
    $row = Get-OrCreate-Row -SheetXml $SheetXml -SheetNs $SheetNs -RowNumber $rowNumber

    $cell = $SheetXml.CreateElement("c", $SheetXml.DocumentElement.NamespaceURI)
    $cell.SetAttribute("r", $CellRef)

    $targetCol = Convert-ColumnNameToNumber ([regex]::Match($CellRef, "^[A-Z]+").Value)
    $inserted = $false

    foreach ($existingCell in @($row.SelectNodes("x:c", $SheetNs))) {
        $existingCol = Convert-ColumnNameToNumber ([regex]::Match($existingCell.GetAttribute("r"), "^[A-Z]+").Value)
        if ($existingCol -gt $targetCol) {
            [void]$row.InsertBefore($cell, $existingCell)
            $inserted = $true
            break
        }
    }

    if (-not $inserted) {
        [void]$row.AppendChild($cell)
    }

    return $cell
}

function Clear-CellValue {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlNamespaceManager]$SheetNs,
        [string]$CellRef
    )

    $cell = $SheetXml.SelectSingleNode("//x:c[@r='$CellRef']", $SheetNs)
    if (-not $cell) {
        return
    }

    if ($cell.HasAttribute("t")) {
        $cell.RemoveAttribute("t")
    }

    foreach ($child in @($cell.ChildNodes)) {
        [void]$cell.RemoveChild($child)
    }
}

function Add-SharedString {
    param(
        [xml]$SharedXml,
        [hashtable]$SharedIndex,
        [System.Collections.Generic.List[string]]$SharedValues,
        [string]$Text
    )

    if ($SharedIndex.ContainsKey($Text)) {
        return $SharedIndex[$Text]
    }

    $si = $SharedXml.CreateElement("si", $SharedXml.DocumentElement.NamespaceURI)
    $t = $SharedXml.CreateElement("t", $SharedXml.DocumentElement.NamespaceURI)
    if ($Text.StartsWith(" ") -or $Text.EndsWith(" ") -or $Text.Contains("`n")) {
        $spaceAttr = $SharedXml.CreateAttribute("xml", "space", "http://www.w3.org/XML/1998/namespace")
        $spaceAttr.Value = "preserve"
        [void]$t.Attributes.Append($spaceAttr)
    }
    $t.InnerText = $Text
    [void]$si.AppendChild($t)
    [void]$SharedXml.sst.AppendChild($si)

    $index = $SharedValues.Count
    $SharedValues.Add($Text)
    $SharedIndex[$Text] = $index

    return $index
}

function Set-StringCellValue {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlNamespaceManager]$SheetNs,
        [xml]$SharedXml,
        [hashtable]$SharedIndex,
        [System.Collections.Generic.List[string]]$SharedValues,
        [string]$CellRef,
        [string]$Text
    )

    $cell = Get-OrCreate-Cell -SheetXml $SheetXml -SheetNs $SheetNs -CellRef $CellRef
    foreach ($child in @($cell.ChildNodes)) {
        [void]$cell.RemoveChild($child)
    }
    $cell.SetAttribute("t", "s")

    $v = $SheetXml.CreateElement("v", $SheetXml.DocumentElement.NamespaceURI)
    $v.InnerText = [string](Add-SharedString -SharedXml $SharedXml -SharedIndex $SharedIndex -SharedValues $SharedValues -Text $Text)
    [void]$cell.AppendChild($v)
}

function Set-NumberCellValue {
    param(
        [xml]$SheetXml,
        [System.Xml.XmlNamespaceManager]$SheetNs,
        [string]$CellRef,
        [string]$NumberText
    )

    $cell = Get-OrCreate-Cell -SheetXml $SheetXml -SheetNs $SheetNs -CellRef $CellRef
    foreach ($child in @($cell.ChildNodes)) {
        [void]$cell.RemoveChild($child)
    }
    if ($cell.HasAttribute("t")) {
        $cell.RemoveAttribute("t")
    }

    $v = $SheetXml.CreateElement("v", $SheetXml.DocumentElement.NamespaceURI)
    $v.InnerText = $NumberText
    [void]$cell.AppendChild($v)
}

$workbookDir = Split-Path -Parent $WorkbookPath
$tempDir = Join-Path $workbookDir ("tmp-xlsx-edit-" + [guid]::NewGuid().ToString())
$repackedPath = Join-Path $workbookDir ("tmp-" + [System.IO.Path]::GetFileName($WorkbookPath))

New-Item -ItemType Directory -Path $tempDir | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($WorkbookPath, $tempDir)

$sharedStringsPath = Join-Path $tempDir "xl\sharedStrings.xml"
$sheetPath = Join-Path $tempDir "xl\worksheets\sheet4.xml"

[xml]$sharedXml = Get-Content -Raw -Path $sharedStringsPath
[xml]$sheetXml = Get-Content -Raw -Path $sheetPath

$sheetNs = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
$sheetNs.AddNamespace("x", $sheetXml.DocumentElement.NamespaceURI)

$sharedValues = New-Object 'System.Collections.Generic.List[string]'
$sharedIndex = @{}
for ($i = 0; $i -lt $sharedXml.sst.si.Count; $i++) {
    $text = Get-SharedStringText $sharedXml.sst.si[$i]
    $sharedValues.Add($text)
    if (-not $sharedIndex.ContainsKey($text)) {
        $sharedIndex[$text] = $i
    }
}

$columnsAtoC = @("A", "B", "C")
$columnsEtoQ = @("E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q")
$columnsAtoN = @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N")

foreach ($row in 10..57) {
    foreach ($column in $columnsAtoC) {
        Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "$column$row"
    }
}

foreach ($row in 9..57) {
    foreach ($column in $columnsEtoQ) {
        Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "$column$row"
    }
}

foreach ($row in 6..7) {
    foreach ($column in $columnsAtoN) {
        if ($column -in @("A", "C", "E", "K", "N") -or $row -eq 7) {
            Clear-CellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef "$column$row"
        }
    }
}

$stringCells = [ordered]@{
    "A6"  = "Passed"
    "C6"  = "Failed"
    "E6"  = "Untested"
    "K6"  = "N/A/B"
    "N6"  = "Total Test Cases"
    "E9"  = "UTCID01"
    "F9"  = "UTCID02"
    "G9"  = "UTCID03"
    "H9"  = "UTCID04"
    "I9"  = "UTCID05"
    "J9"  = "UTCID06"
    "K9"  = "UTCID07"
    "L9"  = "UTCID08"
    "M9"  = "UTCID09"
    "N9"  = "UTCID10"
    "O9"  = "UTCID11"
    "P9"  = "UTCID12"
    "Q9"  = "UTCID13"
    "A10" = "Condition"
    "B10" = "Precondition"
    "C11" = "No existing user matches the submitted email"
    "C12" = "Verification email service is available"
    "C13" = "An existing user already uses the submitted email"
    "C14" = "Verification email service throws a delivery error"
    "C15" = "Legal consent is accepted"
    "C16" = "Request omits the user-agent header"
    "B17" = "email"
    "C18" = '"new.user@gmail.com"'
    "C19" = '"freelancer@gmail.com"'
    "C20" = '"broker@gmail.com"'
    "C21" = '"email.fail@gmail.com"'
    "C22" = '"new.user@mailinator.com"'
    "B23" = "password"
    "C24" = '"securepass1"'
    "C25" = '"securepass"'
    "B26" = "fullName"
    "C27" = '"New User"'
    "B28" = "phoneNumber"
    "C29" = '"0987654321"'
    "C30" = '"12345"'
    "B31" = "role"
    "C32" = "CLIENT"
    "C33" = "FREELANCER"
    "C34" = "BROKER"
    "C35" = "ADMIN"
    "B36" = "domainIds / skillIds"
    "C37" = "not provided"
    "C38" = "domainIds = 2, skillIds = 1"
    "C39" = "domainIds = [], skillIds = []"
    "A42" = "Confirm"
    "B42" = "Return"
    "C43" = "Payload is accepted / request succeeds"
    "C44" = "Returns AuthResponseDto without password data"
    "C45" = "Persists hashed password and consent timestamps"
    "C46" = "Persists selected domain and skill associations"
    "C47" = "Skips saving empty domain and skill associations"
    "C48" = 'Uses "Unknown Device" when request omits the user-agent header'
    "C49" = "Attempts verification email and audit logging during successful service registration"
    "B50" = "Exception"
    "C51" = "ConflictException: email already in use"
    "C52" = "ConflictException: legal consent is missing"
    "C53" = "Validation error: RegisterDto rejects invalid payload"
    "A54" = "Result"
    "B54" = "Type(N : Normal, A : Abnormal, B : Boundary)"
    "B55" = "Passed/Failed"
    "B56" = "Executed Date"
    "B57" = "Defect ID"
    "E54" = "N"
    "F54" = "N"
    "G54" = "N"
    "H54" = "B"
    "I54" = "A"
    "J54" = "N"
    "K54" = "A"
    "L54" = "A"
    "M54" = "A"
    "N54" = "A"
    "O54" = "A"
    "P54" = "A"
    "Q54" = "A"
    "E55" = "P"
    "F55" = "P"
    "G55" = "P"
    "H55" = "P"
    "I55" = "P"
    "J55" = "P"
    "K55" = "P"
    "L55" = "P"
    "M55" = "P"
    "N55" = "P"
    "O55" = "P"
    "P55" = "P"
    "Q55" = "P"
    "E56" = "03-28"
    "F56" = "03-28"
    "G56" = "03-28"
    "H56" = "03-28"
    "I56" = "03-28"
    "J56" = "03-28"
    "K56" = "03-28"
    "L56" = "03-28"
    "M56" = "03-28"
    "N56" = "03-28"
    "O56" = "03-28"
    "P56" = "03-28"
    "Q56" = "03-28"
}

$numberCells = [ordered]@{
    "A7" = "13"
    "C7" = "0"
    "E7" = "0"
    "K7" = "4"
    "L7" = "8"
    "M7" = "1"
    "N7" = "13"
}

foreach ($entry in $stringCells.GetEnumerator()) {
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef $entry.Key -Text $entry.Value
}

foreach ($entry in $numberCells.GetEnumerator()) {
    Set-NumberCellValue -SheetXml $sheetXml -SheetNs $sheetNs -CellRef $entry.Key -NumberText $entry.Value
}

$oCells = @(
    "E15","E18","E24","E27","E29","E32","E37","E43",
    "F11","F12","F15","F18","F24","F27","F29","F32","F37","F43","F44","F45","F49",
    "G11","G12","G15","G19","G24","G27","G29","G33","G38","G43","G44","G45","G46","G49",
    "H11","H12","H15","H20","H24","H27","H29","H34","H39","H43","H44","H45","H47","H49",
    "I11","I14","I15","I21","I24","I27","I29","I32","I37","I43","I44","I45","I49",
    "J15","J18","J24","J27","J29","J32","J37","J43","J44",
    "K15","K16","K18","K24","K27","K29","K32","K37","K43","K44","K48",
    "L13","L15","L18","L24","L27","L29","L32","L37","L51",
    "M11","M18","M24","M27","M29","M32","M37","M52",
    "N15","N18","N24","N27","N29","N35","N37","N53",
    "O15","O18","O24","O27","O30","O32","O37","O53",
    "P15","P22","P24","P27","P29","P32","P37","P53",
    "Q15","Q18","Q25","Q27","Q29","Q32","Q37","Q53"
)

foreach ($cellRef in $oCells) {
    Set-StringCellValue -SheetXml $sheetXml -SheetNs $sheetNs -SharedXml $sharedXml -SharedIndex $sharedIndex -SharedValues $sharedValues -CellRef $cellRef -Text "O"
}

$sharedXml.sst.SetAttribute("count", [string]$sharedXml.sst.si.Count)
$sharedXml.sst.SetAttribute("uniqueCount", [string]$sharedXml.sst.si.Count)

$sharedXml.Save($sharedStringsPath)
$sheetXml.Save($sheetPath)

if (Test-Path $repackedPath) {
    Remove-Item -LiteralPath $repackedPath -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $repackedPath)
Copy-Item -LiteralPath $repackedPath -Destination $WorkbookPath -Force

Remove-Item -LiteralPath $repackedPath -Force
Remove-Item -LiteralPath $tempDir -Recurse -Force

Write-Output "Updated workbook: $WorkbookPath"
