param(
  [Parameter(Mandatory = $true)]
  [string]$InputJson,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$WorksheetName = 'Traceability',

  [switch]$Overwrite
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ColumnName {
  param([int]$Index)

  $name = ''
  while ($Index -gt 0) {
    $remainder = ($Index - 1) % 26
    $name = [char](65 + $remainder) + $name
    $Index = [math]::Floor(($Index - 1) / 26)
  }

  return $name
}

function Escape-Xml {
  param([string]$Value)

  if ($null -eq $Value) {
    return ''
  }

  return [System.Security.SecurityElement]::Escape($Value)
}

function Write-Utf8File {
  param(
    [string]$Path,
    [string]$Content
  )

  $directory = Split-Path -Parent $Path
  if ($directory -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function New-CellXml {
  param(
    [int]$ColumnIndex,
    [int]$RowIndex,
    [string]$Value
  )

  if ([string]::IsNullOrEmpty($Value)) {
    return ''
  }

  $cellRef = '{0}{1}' -f (Get-ColumnName -Index $ColumnIndex), $RowIndex
  $escapedValue = Escape-Xml -Value $Value
  return '<c r="{0}" t="inlineStr"><is><t xml:space="preserve">{1}</t></is></c>' -f $cellRef, $escapedValue
}

function New-RowXml {
  param(
    [int]$RowIndex,
    [object[]]$Values,
    [int]$MaxColumns
  )

  $cells = New-Object System.Collections.Generic.List[string]
  $valueCount = Get-ItemCount -Value $Values
  for ($column = 1; $column -le $MaxColumns; $column++) {
    $value = ''
    if ($column -le $valueCount -and $null -ne $Values[$column - 1]) {
      $value = [string]$Values[$column - 1]
    }

    $cellXml = New-CellXml -ColumnIndex $column -RowIndex $RowIndex -Value $value
    if ($cellXml) {
      [void]$cells.Add($cellXml)
    }
  }

  return '<row r="{0}">{1}</row>' -f $RowIndex, ($cells -join '')
}

function ConvertTo-RowArray {
  param([object]$Row)

  $result = New-Object System.Collections.Generic.List[object]
  if ($null -eq $Row) {
    return @()
  }

  foreach ($cell in $Row) {
    if ($null -eq $cell) {
      [void]$result.Add('')
    }
    else {
      [void]$result.Add([string]$cell)
    }
  }

  return $result.ToArray()
}

function Get-ItemCount {
  param([object]$Value)

  if ($null -eq $Value) {
    return 0
  }

  if ($Value -is [System.Array]) {
    return $Value.Length
  }

  if ($Value -is [System.Collections.ICollection]) {
    return $Value.Count
  }

  return @($Value).Length
}

function Get-DefaultColumnWidths {
  param(
    [object[][]]$Rows,
    [int]$MaxColumns
  )

  $widths = @()
  for ($column = 0; $column -lt $MaxColumns; $column++) {
    $maxLength = 10
    foreach ($row in $Rows) {
      $rowCount = Get-ItemCount -Value $row
      if ($column -lt $rowCount -and $null -ne $row[$column]) {
        $length = ([string]$row[$column]).Length
        if ($length -gt $maxLength) {
          $maxLength = $length
        }
      }
    }

    $width = [math]::Min([math]::Max($maxLength + 2, 10), 48)
    $widths += [string]$width
  }

  return $widths
}

function Get-SafeSheetName {
  param([string]$Name)

  $sanitized = $Name -replace '[:\\/\?\*\[\]]', '_'
  if ([string]::IsNullOrWhiteSpace($sanitized)) {
    $sanitized = 'Traceability'
  }

  if ($sanitized.Length -gt 31) {
    $sanitized = $sanitized.Substring(0, 31)
  }

  return $sanitized
}

if (-not (Test-Path $InputJson)) {
  throw "Input JSON file not found: $InputJson"
}

if ((Test-Path $OutputPath) -and -not $Overwrite) {
  throw "Output file already exists: $OutputPath. Use -Overwrite to replace it."
}

$jsonText = Get-Content -Path $InputJson -Raw
$payload = $jsonText | ConvertFrom-Json

$rowsSource = $null
if ($payload -is [System.Array]) {
  $rowsSource = $payload
}
elseif ($payload.PSObject.Properties.Name -contains 'rows') {
  $rowsSource = $payload.rows
}
else {
  throw 'Input JSON must be either an array of rows or an object with a rows property.'
}

$sheetName = $WorksheetName
if ($payload -isnot [System.Array] -and ($payload.PSObject.Properties.Name -contains 'sheetName')) {
  $sheetName = [string]$payload.sheetName
}
$sheetName = Get-SafeSheetName -Name $sheetName

$rows = New-Object System.Collections.Generic.List[object[]]
foreach ($row in $rowsSource) {
  [void]$rows.Add((ConvertTo-RowArray -Row $row))
}

if ($rows.Count -eq 0) {
  throw 'At least one row is required to generate a workbook.'
}

$maxColumns = 1
foreach ($row in $rows) {
  $rowCount = Get-ItemCount -Value $row
  if ($rowCount -gt $maxColumns) {
    $maxColumns = $rowCount
  }
}

$columnWidths = @()
if ($payload -isnot [System.Array] -and ($payload.PSObject.Properties.Name -contains 'columnWidths')) {
  foreach ($width in $payload.columnWidths) {
    $columnWidths += [string]$width
  }
}
if ((Get-ItemCount -Value $columnWidths) -lt $maxColumns) {
  $columnWidths = Get-DefaultColumnWidths -Rows $rows.ToArray() -MaxColumns $maxColumns
}

$rowXml = for ($i = 0; $i -lt $rows.Count; $i++) {
  New-RowXml -RowIndex ($i + 1) -Values $rows[$i] -MaxColumns $maxColumns
}

$colXmlParts = New-Object System.Collections.Generic.List[string]
for ($columnIndex = 1; $columnIndex -le $maxColumns; $columnIndex++) {
  $width = [string]$columnWidths[$columnIndex - 1]
  $colXml = [string]::Format(
    '<col min="{0}" max="{0}" width="{1}" customWidth="1"/>',
    $columnIndex,
    $width
  )
  [void]$colXmlParts.Add($colXml)
}

$dimension = 'A1:{0}{1}' -f (Get-ColumnName -Index $maxColumns), $rows.Count

$sheetXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="$dimension"/>
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    $($colXmlParts -join "`n    ")
  </cols>
  <sheetData>
    $($rowXml -join "`n    ")
  </sheetData>
</worksheet>
"@

$workbookXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="$sheetName" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
"@

$workbookRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
                Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
                Target="styles.xml"/>
</Relationships>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1">
    <font>
      <sz val="11"/>
      <name val="Calibri"/>
    </font>
  </fonts>
  <fills count="2">
    <fill>
      <patternFill patternType="none"/>
    </fill>
    <fill>
      <patternFill patternType="gray125"/>
    </fill>
  </fills>
  <borders count="1">
    <border>
      <left/>
      <right/>
      <top/>
      <bottom/>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>
"@

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"
            ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml"
            ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml"
            ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml"
            ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml"
            ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

$rootRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
                Target="xl/workbook.xml"/>
  <Relationship Id="rId2"
                Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"
                Target="docProps/core.xml"/>
  <Relationship Id="rId3"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"
                Target="docProps/app.xml"/>
</Relationships>
"@

$utcTimestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:dcmitype="http://purl.org/dc/dcmitype/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>$sheetName</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$utcTimestamp</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$utcTimestamp</dcterms:modified>
</cp:coreProperties>
"@

$appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant>
        <vt:lpstr>Worksheets</vt:lpstr>
      </vt:variant>
      <vt:variant>
        <vt:i4>1</vt:i4>
      </vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>$sheetName</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company></Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0300</AppVersion>
</Properties>
"@

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory -and -not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('traceability-xlsx-' + [guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $tempRoot 'package'

New-Item -ItemType Directory -Path $packageRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot '_rels') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'docProps') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'xl') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'xl\_rels') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'xl\worksheets') | Out-Null

Write-Utf8File -Path (Join-Path $packageRoot '[Content_Types].xml') -Content $contentTypesXml
Write-Utf8File -Path (Join-Path $packageRoot '_rels\.rels') -Content $rootRelsXml
Write-Utf8File -Path (Join-Path $packageRoot 'docProps\core.xml') -Content $coreXml
Write-Utf8File -Path (Join-Path $packageRoot 'docProps\app.xml') -Content $appXml
Write-Utf8File -Path (Join-Path $packageRoot 'xl\workbook.xml') -Content $workbookXml
Write-Utf8File -Path (Join-Path $packageRoot 'xl\_rels\workbook.xml.rels') -Content $workbookRelsXml
Write-Utf8File -Path (Join-Path $packageRoot 'xl\styles.xml') -Content $stylesXml
Write-Utf8File -Path (Join-Path $packageRoot 'xl\worksheets\sheet1.xml') -Content $sheetXml

$zipPath = [System.IO.Path]::ChangeExtension($OutputPath, '.zip')
if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
}
if (Test-Path $OutputPath) {
  Remove-Item -Path $OutputPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($packageRoot, $zipPath)
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item -Path $tempRoot -Recurse -Force

Write-Output $OutputPath
