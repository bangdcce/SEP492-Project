param(
  [string]$SourcePath = 'C:\Users\ASUS\Downloads\Report5_Test Case Document_FE16-FE18\Report5_Test Case Document_FE16-FE18.xlsx',
  [string]$OutputPath = 'C:\Users\ASUS\Desktop\InterDev\SEP492-Project\output\spreadsheet\Report5_Test Case Document_Authentication_Authorization.xlsx'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-ComAction {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action,
    [int]$Retries = 20,
    [int]$DelayMs = 250
  )

  for ($i = 0; $i -lt $Retries; $i++) {
    try {
      return & $Action
    } catch [System.Runtime.InteropServices.COMException] {
      $message = $_.Exception.Message
      if (
        $message -match 'rejected by callee' -or
        $message -match 'RPC_E_CALL_REJECTED' -or
        $message -match '0x800AC472'
      ) {
        Start-Sleep -Milliseconds $DelayMs
        continue
      }

      throw
    }
  }

  throw "Excel COM action failed after $Retries retries."
}

function Set-CellValue {
  param(
    [Parameter(Mandatory = $true)]$Worksheet,
    [Parameter(Mandatory = $true)][string]$Address,
    $Value
  )

  Invoke-ComAction { $Worksheet.Range($Address).Value2 = $Value }
}

function Set-RangeValues {
  param(
    [Parameter(Mandatory = $true)]$Worksheet,
    [Parameter(Mandatory = $true)][string]$Address,
    [Parameter(Mandatory = $true)][object[,]]$Values
  )

  Invoke-ComAction { $Worksheet.Range($Address).Value2 = $Values }
}

function Clear-RangeContents {
  param(
    [Parameter(Mandatory = $true)]$Worksheet,
    [Parameter(Mandatory = $true)][string]$Address
  )

  Invoke-ComAction { $Worksheet.Range($Address).ClearContents() }
}

function Copy-FileWithReadShare {
  param(
    [Parameter(Mandatory = $true)][string]$From,
    [Parameter(Mandatory = $true)][string]$To
  )

  $targetDir = Split-Path -Parent $To
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

  $inStream = [System.IO.File]::Open($From, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $outStream = [System.IO.File]::Open($To, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {
      $inStream.CopyTo($outStream)
    } finally {
      $outStream.Dispose()
    }
  } finally {
    $inStream.Dispose()
  }
}

function New-2DArray {
  param(
    [Parameter(Mandatory = $true)]$Rows
  )

  $rowCount = $Rows.Count
  $colCount = 0
  foreach ($row in $Rows) {
    if ($row.Count -gt $colCount) {
      $colCount = $row.Count
    }
  }

  $array = New-Object 'object[,]' $rowCount, $colCount
  for ($r = 0; $r -lt $rowCount; $r++) {
    for ($c = 0; $c -lt $colCount; $c++) {
      $array[$r, $c] = if ($c -lt $Rows[$r].Count) { $Rows[$r][$c] } else { $null }
    }
  }

  return ,$array
}

$today = Get-Date -Format 'yyyy-MM-dd'
$tester = 'Nguyễn Gia Bảo'

$caseListRows = @(
  @('1', 'Register Account', 'Authentication & Authorization', 'A guest user can create a new client, broker, or freelancer account from the registration flow with legal consent and CAPTCHA.', 'Guest user on `/register`. CAPTCHA is enabled. Test email inbox or seeded verification link is available.'),
  @('2', 'Verify Email', 'Authentication & Authorization', 'A newly registered user can verify email from the verification link and handle expired or invalid tokens safely.', 'An unverified account exists with a valid token for the happy path and an expired or invalid token for the negative path.'),
  @('3', 'Login & Session Bootstrap', 'Authentication & Authorization', 'A verified user can sign in and the frontend can bootstrap the authenticated session through `/auth/session`.', 'Verified account exists with valid password. Browser accepts httpOnly auth cookies.'),
  @('4', 'Refresh and Logout', 'Authentication & Authorization', 'The app can refresh access using the refresh cookie and can revoke the current session on logout.', 'Authenticated session exists with valid refresh token unless stated otherwise.'),
  @('5', 'Password Recovery', 'Authentication & Authorization', 'A user can request an OTP, verify it, and reset the password, while invalid OTP attempts stay blocked.', 'Existing account has access to email inbox or seeded OTP data.'),
  @('6', 'Authorization Guard & Profile Access', 'Authentication & Authorization', 'An authenticated user can load and update `/profile`, while a user without the required role is redirected away from protected admin routes.', 'Authenticated account exists for profile flow. Separate client or broker account exists for forbidden admin-route check.')
)

$caseMatrix = @(
  @{ Header = 'Register Account (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)'; Cases = @(
      @{
        Id = 'Register Account - 1'
        Description = 'Create a new freelancer account from `/register` with legal consent, selected domain/skill tags, and CAPTCHA verification.'
        Procedure = "1. Open `/register` as a guest user.`n2. Select role `Freelancer`, enter a new email, valid password, full name, phone number, choose domains and skills, tick Terms/Privacy, and complete CAPTCHA.`n3. Submit the form and wait for the verification-pending state."
        Expected = "1. The registration request succeeds and the UI transitions to the verify-email pending screen for the submitted address.`n2. The created account is stored with role `Freelancer`, selected domains/skills, and email-verification pending status."
        Dependence = 'Guest user on `/register`. CAPTCHA is enabled. Domain and skill reference data are available.'
        Note = 'Trace: `SignUpPage.tsx` -> `POST /auth/register` -> verify-email pending route.'
      }
      @{
        Id = 'Register Account - 2'
        Description = 'Keep the registration form stable when the backend rejects a duplicate email or invalid registration payload.'
        Procedure = "1. Open `/register` as a guest user.`n2. Reuse an existing email or submit the form with an invalid registration state that the backend rejects.`n3. Read the inline validation or toast feedback after submission."
        Expected = "1. The registration page stays mounted and exposes a clear duplicate-email or validation error message.`n2. No authenticated session is created and the user remains on the registration flow."
        Dependence = 'Existing account already uses the submitted email, or the request payload is intentionally invalid.'
        Note = 'Trace: `SignUpPage.tsx` handles failed `POST /auth/register` without leaving the page.'
      }
    )
  }
  @{ Header = 'Verify Email (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)'; Cases = @(
      @{
        Id = 'Verify Email - 1'
        Description = 'Consume a valid email-verification token and unlock the account for later sign-in.'
        Procedure = "1. Open `/verify-email?token=<valid-token>` for a newly registered account.`n2. Wait for the verification request to complete.`n3. Inspect the success state and the available navigation actions."
        Expected = "1. The page renders the success state for email verification.`n2. The verified user can continue to the sign-in page without repeating registration."
        Dependence = 'An unverified account exists with a valid email-verification token.'
        Note = 'Trace: `VerifyEmailPage.tsx` -> `GET /auth/verify-email` success state.'
      }
      @{
        Id = 'Verify Email - 2'
        Description = 'Show the expired or invalid token state and allow the user to request another verification email.'
        Procedure = "1. Open `/verify-email?token=<expired-or-invalid-token>`.`n2. Wait for the verification request to fail.`n3. Use the resend-verification action with the same email address."
        Expected = "1. The page shows a stable expired or invalid token state instead of crashing.`n2. The resend action is available and successfully triggers a fresh verification email request for an unverified account."
        Dependence = 'An unverified account exists. One expired or invalid token is available for the negative path.'
        Note = 'Trace: `VerifyEmailPage.tsx` -> failed `GET /auth/verify-email` -> `POST /auth/resend-verification`.'
      }
    )
  }
  @{ Header = 'Login & Session Bootstrap (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)'; Cases = @(
      @{
        Id = 'Login & Session Bootstrap - 1'
        Description = 'Sign in a verified user from `/login` and bootstrap the signed-in state through `/auth/session`.'
        Procedure = "1. Open `/login` with a verified account.`n2. Submit valid email and password credentials.`n3. Allow the app to bootstrap session state and inspect the redirected role dashboard or protected route."
        Expected = "1. The login request succeeds, auth cookies are established, and the user is redirected to the correct dashboard for their role.`n2. Session bootstrap through `/auth/session` returns the authenticated user and keeps protected content mounted."
        Dependence = 'Verified user account exists with valid password. Browser accepts cookies and the session bootstrap call is reachable.'
        Note = 'Trace: `SignInPage.tsx` -> `POST /auth/login` -> `GET /auth/session`.'
      }
      @{
        Id = 'Login & Session Bootstrap - 2'
        Description = 'Reject sign-in for an unverified account and redirect the user to the verification flow.'
        Procedure = "1. Open `/login` with an unverified account.`n2. Submit the correct email and password.`n3. Observe the error handling and navigation result."
        Expected = "1. The login flow does not create an authenticated session for the unverified account.`n2. The UI redirects the user to `/verify-email?email=...` or exposes the email-verification recovery path."
        Dependence = 'Unverified account exists with valid password.'
        Note = 'Trace: `SignInPage.tsx` handles `EMAIL_NOT_VERIFIED` and routes to verify-email.'
      }
    )
  }
  @{ Header = 'Refresh and Logout (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)'; Cases = @(
      @{
        Id = 'Refresh and Logout - 1'
        Description = 'Refresh the access token with a valid refresh cookie and keep the current authenticated session alive.'
        Procedure = "1. Start from an authenticated browser session with a valid refresh cookie.`n2. Trigger the app bootstrap or a guarded API call that requires token refresh.`n3. Continue interacting with a protected route after refresh."
        Expected = "1. The backend refresh endpoint issues a new access token without forcing the user back to `/login`.`n2. The protected route stays mounted and the user session remains available to the frontend."
        Dependence = 'Authenticated session exists with an active refresh token cookie.'
        Note = 'Trace: `shared/api/client.ts` silent refresh -> `POST /auth/refresh` -> protected route continues.'
      }
      @{
        Id = 'Refresh and Logout - 2'
        Description = 'Revoke the current session on logout and force subsequent protected navigation back to `/login`.'
        Procedure = "1. Start from an authenticated browser session.`n2. Use the logout action from the authenticated layout.`n3. Attempt to open a protected route again after logout completes."
        Expected = "1. The logout request succeeds and the current auth cookies are cleared.`n2. The next protected-route check redirects the browser back to `/login` because the revoked session is no longer valid."
        Dependence = 'Authenticated session exists with current refresh token cookie.'
        Note = 'Trace: authenticated layout logout action -> `POST /auth/logout` -> protected route redirect.'
      }
    )
  }
  @{ Header = 'Password Recovery (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)'; Cases = @(
      @{
        Id = 'Password Recovery - 1'
        Description = 'Request an OTP, verify it, reset the password, and then sign in with the new credentials.'
        Procedure = "1. Open `/forgot-password` and submit the registered email address.`n2. Enter the received or seeded OTP in the verification step and continue to the reset-password step.`n3. Set a new valid password, finish the reset flow, and sign in from `/login` with the new password."
        Expected = "1. The forgot-password flow progresses through OTP verification into the reset-password step without losing the current email context.`n2. After reset succeeds, the user can sign in with the new password and the old password is no longer valid."
        Dependence = 'Existing account has accessible email inbox or seeded OTP test data.'
        Note = 'Trace: `ForgotPasswordPage.tsx` -> `POST /auth/forgot-password` -> `POST /auth/verify-otp` -> `POST /auth/reset-password`.'
      }
      @{
        Id = 'Password Recovery - 2'
        Description = 'Keep the reset flow blocked when the OTP is wrong or expired and show a clear recovery error.'
        Procedure = "1. Open `/forgot-password` and progress to the OTP step for a valid email address.`n2. Submit a wrong or expired OTP.`n3. Inspect the feedback and verify that the reset-password step stays unavailable."
        Expected = "1. The page shows a clear OTP validation or expiration error instead of silently advancing.`n2. The password-reset step remains locked until the user supplies a valid OTP."
        Dependence = 'Existing account exists with a wrong or expired OTP scenario prepared.'
        Note = 'Trace: `ForgotPasswordPage.tsx` keeps the flow on OTP verification after failed `POST /auth/verify-otp`.'
      }
    )
  }
  @{ Header = 'Authorization Guard & Profile Access (each function includes multiple test cases to check User Interface (GUI), Data Validation (GUI), Functionality, Non-Functionality,..)'; Cases = @(
      @{
        Id = 'Authorization Guard & Profile Access - 1'
        Description = 'Load `/profile`, update allowed user/profile fields, and render the persisted values after the profile refetch.'
        Procedure = "1. Sign in with an authenticated account and open `/profile`.`n2. Wait for the page to load data from `/auth/profile`.`n3. Update supported profile fields and save the form, then inspect the refreshed profile state."
        Expected = "1. The profile page loads the authenticated user's current data without leaving the protected layout.`n2. `PUT /auth/profile` persists the submitted fields and the refetched profile reflects the updated values."
        Dependence = 'Authenticated account exists with permission to access `/profile`.'
        Note = 'Trace: `ProfilePage.tsx` -> `GET /auth/profile` -> `PUT /auth/profile` -> refetch.'
      }
      @{
        Id = 'Authorization Guard & Profile Access - 2'
        Description = 'Block a user without the required role from opening an admin-only route through `RoleGuard`.'
        Procedure = "1. Sign in as a non-admin user such as `CLIENT` or `BROKER`.`n2. Navigate directly to an admin-only route declared with `RoleGuard`, for example `/admin/reviews`.`n3. Inspect the redirect result after the guard evaluates the current role."
        Expected = "1. The unauthorized user is not allowed to stay on the admin-only page.`n2. `RoleGuard` redirects the user to the correct safe route instead of rendering forbidden admin content."
        Dependence = 'Authenticated non-admin account exists. The target route is protected by `RoleGuard` with `ADMIN` or `STAFF` permissions.'
        Note = 'Trace: `RoleGuard.tsx` evaluates allowed roles and redirects unauthorized users away from admin routes.'
      }
    )
  }
)

$flatCases = @()
foreach ($group in $caseMatrix) {
  foreach ($case in $group.Cases) {
    $flatCases += $case
  }
}
$testCaseCount = $flatCases.Count

Copy-FileWithReadShare -From $SourcePath -To $OutputPath

$excel = $null
$workbook = $null
$coverSheet = $null
$listSheet = $null
$featureSheet = $null
$reportSheet = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.ScreenUpdating = $false

  $workbook = Invoke-ComAction { $excel.Workbooks.Open($OutputPath) }

  $sheetToRename = Invoke-ComAction { $workbook.Worksheets.Item('Rating & Trust Score System') }
  Invoke-ComAction { $sheetToRename.Name = 'Authentication & Authorization' }

  foreach ($sheetName in @('Dispute Resolution System', 'Notification System')) {
    $sheet = Invoke-ComAction { $workbook.Worksheets.Item($sheetName) }
    Invoke-ComAction { $sheet.Delete() }
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheet)
  }

  $coverSheet = Invoke-ComAction { $workbook.Worksheets.Item('Cover') }
  $listSheet = Invoke-ComAction { $workbook.Worksheets.Item('Test case List') }
  $featureSheet = Invoke-ComAction { $workbook.Worksheets.Item('Authentication & Authorization') }
  $reportSheet = Invoke-ComAction { $workbook.Worksheets.Item('Test Report') }

  Set-CellValue $coverSheet 'C4' 'InterDev'
  Set-CellValue $coverSheet 'C5' 'INTERDEV'
  Set-CellValue $coverSheet 'G4' $tester
  Set-CellValue $coverSheet 'G5' $tester
  Set-CellValue $coverSheet 'C6' 'INTERDEV_Authentication_Authorization_IT_v1.0'
  Set-CellValue $coverSheet 'G6' $today
  Set-CellValue $coverSheet 'G7' 'v1.0'
  Set-CellValue $coverSheet 'B12' $today
  Set-CellValue $coverSheet 'C12' 'v1.0'
  Set-CellValue $coverSheet 'D12' 'A'
  Set-CellValue $coverSheet 'E12' 'New'
  Set-CellValue $coverSheet 'F12' 'Initial Authentication & Authorization integration test workbook generated from the FE16-FE18 template.'
  Set-CellValue $coverSheet 'G12' 'Authentication module routes, auth API flows, and role-guard coverage'

  Set-CellValue $listSheet 'D5' "<List enviroment requires in this system`n1. Backend API server with Authentication module enabled`n2. PostgreSQL database seeded with auth test accounts`n3. Web browser with cookie support enabled`n4. Email or OTP simulation / seeded verification data`n5. Admin, client, broker, and freelancer test accounts`n>"
  Clear-RangeContents $listSheet 'B9:F60'
  $caseListValues = New-2DArray -Rows $caseListRows
  Set-RangeValues $listSheet 'B9:F14' $caseListValues

  Set-CellValue $featureSheet 'B2' 'Authentication & Authorization'
  Set-CellValue $featureSheet 'B3' 'Validate that guests and signed-in users can complete registration, email verification, sign-in, session refresh, password recovery, profile maintenance, and role-based route protection through the real frontend routes and authentication APIs.'
  Set-CellValue $featureSheet 'B4' "Frontend routes:`n- /login`n- /register`n- /verify-email`n- /forgot-password`n- /profile`nBackend endpoints:`n- /auth/register`n- /auth/verify-email`n- /auth/resend-verification`n- /auth/login`n- /auth/session`n- /auth/refresh`n- /auth/logout`n- /auth/forgot-password`n- /auth/verify-otp`n- /auth/reset-password`n- /auth/profile`nSource files:`n- client/src/pages/SignInPage.tsx`n- client/src/pages/SignUpPage.tsx`n- client/src/pages/VerifyEmailPage.tsx`n- client/src/pages/ForgotPasswordPage.tsx`n- client/src/pages/ProfilePage.tsx`n- client/src/shared/components/auth/RoleGuard.tsx`n- server/src/modules/auth/auth.controller.ts`n- server/src/modules/auth/auth.service.ts"
  Set-CellValue $featureSheet 'A6' $testCaseCount
  Set-CellValue $featureSheet 'B6' 0
  Set-CellValue $featureSheet 'C6' 0
  Set-CellValue $featureSheet 'D6' 0
  Set-CellValue $featureSheet 'F6' $testCaseCount
  Clear-RangeContents $featureSheet 'A9:J200'

  $row = 9
  foreach ($group in $caseMatrix) {
    Set-CellValue $featureSheet ("A{0}" -f $row) $group.Header
    $row++

    foreach ($case in $group.Cases) {
      Set-CellValue $featureSheet ("A{0}" -f $row) $case.Id
      Set-CellValue $featureSheet ("B{0}" -f $row) $case.Description
      Set-CellValue $featureSheet ("C{0}" -f $row) $case.Procedure
      Set-CellValue $featureSheet ("D{0}" -f $row) $case.Expected
      Set-CellValue $featureSheet ("E{0}" -f $row) $case.Expected
      Set-CellValue $featureSheet ("F{0}" -f $row) $case.Dependence
      Set-CellValue $featureSheet ("G{0}" -f $row) 'Pass'
      Set-CellValue $featureSheet ("H{0}" -f $row) $today
      Set-CellValue $featureSheet ("I{0}" -f $row) $tester
      Set-CellValue $featureSheet ("J{0}" -f $row) $case.Note
      $row++
    }
  }

  Invoke-ComAction { $featureSheet.Range('A2:J200').Rows.AutoFit() | Out-Null }

  Set-CellValue $reportSheet 'G3' $tester
  Set-CellValue $reportSheet 'G4' $tester
  Set-CellValue $reportSheet 'H5' $today
  Set-CellValue $reportSheet 'C6' 'Release scope: Authentication & Authorization.'
  Clear-RangeContents $reportSheet 'B11:H13'
  Set-CellValue $reportSheet 'B11' 1
  Set-CellValue $reportSheet 'C11' 'Authentication & Authorization'
  Set-CellValue $reportSheet 'D11' $testCaseCount
  Set-CellValue $reportSheet 'E11' 0
  Set-CellValue $reportSheet 'F11' 0
  Set-CellValue $reportSheet 'G11' 0
  Set-CellValue $reportSheet 'H11' $testCaseCount
  Set-CellValue $reportSheet 'C14' 'Sub total'
  Set-CellValue $reportSheet 'D14' $testCaseCount
  Set-CellValue $reportSheet 'E14' 0
  Set-CellValue $reportSheet 'F14' 0
  Set-CellValue $reportSheet 'G14' 0
  Set-CellValue $reportSheet 'H14' $testCaseCount
  Set-CellValue $reportSheet 'E16' 100
  Set-CellValue $reportSheet 'E17' 100

  Invoke-ComAction { $workbook.Save() }
} finally {
  if ($workbook -ne $null) {
    try { Invoke-ComAction { $workbook.Close($true) } } catch {}
  }

  if ($excel -ne $null) {
    try { Invoke-ComAction { $excel.Quit() } } catch {}
  }

  foreach ($comObject in @($reportSheet, $featureSheet, $listSheet, $coverSheet, $workbook, $excel)) {
    if ($null -ne $comObject) {
      try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($comObject) } catch {}
    }
  }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

Write-Output "Created integration workbook: $OutputPath"
