# Input Shape

Use a JSON object with this strict Test Case Document structure.

Model the workbook as:

- `features[]` = feature/module sheets
- `functions[]` = function summary rows inside that feature
- `sections[]` = function groups inside the feature sheet
- `relatedUseCases` / `useCaseRefs` = optional UC traceability metadata only

Do not default to `1 UC = 1 sheet`.

```json
{
  "project": {
    "projectName": "SEP492 Software Brokerage Platform",
    "projectCode": "SEP492",
    "documentCode": "SEP492_UC12_System_Test_v1.0",
    "creator": "SonNT",
    "reviewerApprover": "Supervisor Name",
    "issueDate": "21/03/2026",
    "version": "v1.0",
    "defaultTester": "SonNT",
    "environment": [
      "1. Server: https://example.test",
      "2. Database: PostgreSQL",
      "3. Web Browser: Chrome"
    ],
    "notes": "Release 1 covers marketplace request flow.",
    "changeLog": [
      {
        "effectiveDate": "21/03/2026",
        "version": "v1.0",
        "changeItem": "UC-12 Post Request To Marketplace",
        "changeType": "A",
        "description": "Initial strict test-case document.",
        "reference": "UC-12 use-case specification"
      }
    ]
  },
  "features": [
    {
      "code": "MARKETPLACE",
      "name": "Marketplace Request Management",
      "testRequirement": "Validate request posting, broker application, and broker acceptance flows across related marketplace use cases.",
      "referenceDocument": [
        "Marketplace feature specification",
        "project-requests module specification"
      ],
      "statistics": {
        "passed": 5,
        "failed": 1,
        "untested": 2,
        "na": 0
      },
      "functions": [
        {
          "name": "Publish Request",
          "description": "Client posts a request publicly to the marketplace.",
          "preCondition": "Client KYC is approved and required wizard data is filled.",
          "relatedUseCases": ["UC-12", "UC-15"],
          "actor": "Client",
          "done": true
        },
        {
          "name": "Apply To Request",
          "description": "Broker finds a public request and applies.",
          "preCondition": "Request is PUBLIC_DRAFT and broker is authenticated.",
          "relatedUseCases": ["UC-12", "UC-18"],
          "actor": "Broker",
          "done": true
        }
      ],
      "sections": [
        {
          "title": "Publish Request",
          "testCases": [
            {
              "id": "[F-Publish-01]",
              "description": "Post a new request to the marketplace successfully.",
              "procedure": "1. Login as approved client.\\n2. Complete the wizard.\\n3. Click Post to Market.",
              "expectedResults": "1. Request is created.\\n2. Status becomes PUBLIC_DRAFT.",
              "actualResults": "Request created successfully and saved as PUBLIC_DRAFT.",
              "dependencies": "Client account exists and KYC is APPROVED.",
              "useCaseRefs": ["UC-12"],
              "result": "Pass",
              "testDate": "21/03/2026",
              "tester": "SonNT",
              "note": ""
            },
            {
              "id": "[F-Publish-02]",
              "description": "Reject publish when the request is already in a non-publishable state.",
              "procedure": "1. Open an assigned request.\\n2. Trigger the publish flow.",
              "expectedResults": "1. The system blocks the action.\\n2. A validation error is shown.",
              "actualResults": "Publish was rejected because the request was already assigned.",
              "dependencies": "Request exists and is already assigned.",
              "useCaseRefs": ["UC-12", "UC-15"],
              "result": "Pass",
              "testDate": "21/03/2026",
              "tester": "SonNT",
              "note": ""
            }
          ]
        },
        {
          "title": "Apply To Request",
          "testCases": [
            {
              "id": "[F-Apply-01]",
              "description": "Broker applies to a PUBLIC_DRAFT request successfully.",
              "procedure": "1. Login as broker.\\n2. Open a public request.\\n3. Submit the application.",
              "expectedResults": "1. Proposal is created in PENDING state.\\n2. Broker sees a successful submission.",
              "actualResults": "Pending broker proposal was created successfully.",
              "dependencies": "Broker account exists and request is PUBLIC_DRAFT.",
              "useCaseRefs": ["UC-12", "UC-18"],
              "result": "Pass",
              "testDate": "21/03/2026",
              "tester": "SonNT",
              "note": ""
            }
          ]
        }
      ]
    }
  ]
}
```

Notes:

- Use `features[].functions` for the `Test case List` summary rows.
- Use `features[].sections[].testCases` for each `FeatureN` sheet detail row.
- Use `sections[]` to represent functions inside the feature sheet. In most cases, keep one section per function.
- Use `functions[].relatedUseCases` when one function is shared by multiple UC flows.
- Use `testCases[].useCaseRefs` when an individual case traces to specific UC IDs.
- Use `Pass`, `Fail`, `Untested`, or `N/A` for `testCases[].result`.
- Use `actualResults` to capture what was truly observed during testing or from verified evidence.
- Use `project.defaultTester` to fill blank tester cells; the generator also replaces placeholder `Codex` with this default tester.
- Use `dependencies` for the `Inter-test case Dependence` column.
- If `statistics` is omitted, the generator computes totals from `testCases[].result`.
- The strict bundled template currently supports up to `2` visible `FeatureN` sheets.
- The generator still supports the old round-based layout when you explicitly pass the legacy template, but this reference file is for the strict no-round format.
