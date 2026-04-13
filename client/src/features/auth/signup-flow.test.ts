import test from "node:test";
import assert from "node:assert/strict";
import {
  getSignupStepLabels,
  getSignupTransport,
  validateStaffCvFile,
  validateStaffKycDraft,
} from "./signup-flow.ts";

test("staff signup uses Upload CV and Manual KYC steps", () => {
  assert.deepEqual(getSignupStepLabels("staff"), [
    "Role",
    "Account Info",
    "Upload CV",
    "Manual KYC",
  ]);
});

test("non-staff taxonomy roles keep Domain and Skills steps", () => {
  assert.deepEqual(getSignupStepLabels("broker"), [
    "Role",
    "Account Info",
    "Domain",
    "Skills",
  ]);
  assert.deepEqual(getSignupStepLabels("freelancer"), [
    "Role",
    "Account Info",
    "Domain",
    "Skills",
  ]);
});

test("staff signup uses multipart endpoint while non-staff keeps JSON endpoint", () => {
  assert.deepEqual(getSignupTransport("staff"), {
    endpoint: "/auth/register/staff",
    mode: "multipart",
  });
  assert.deepEqual(getSignupTransport("client"), {
    endpoint: "/auth/register",
    mode: "json",
  });
});

test("staff CV validation enforces required, mime type, and size rules", () => {
  assert.equal(validateStaffCvFile(null), "CV is required");
  assert.equal(
    validateStaffCvFile({
      name: "resume.txt",
      type: "text/plain",
      size: 1024,
    }),
    "Only PDF and DOCX files are allowed",
  );
  assert.equal(
    validateStaffCvFile({
      name: "resume.pdf",
      type: "application/pdf",
      size: 6 * 1024 * 1024,
    }),
    "File size must not exceed 5MB",
  );
  assert.equal(
    validateStaffCvFile({
      name: "resume.pdf",
      type: "application/pdf",
      size: 1024,
    }),
    null,
  );
});

test("manual KYC validation requires all text fields and valid image uploads", () => {
  const errors = validateStaffKycDraft({
    fullNameOnDocument: "",
    documentType: "",
    documentNumber: "",
    dateOfBirth: "",
    address: "",
    idCardFront: null,
    idCardBack: {
      name: "back.pdf",
      type: "application/pdf",
      size: 100,
    },
    selfie: null,
  });

  assert.equal(errors.fullNameOnDocument, "Full name on document is required");
  assert.equal(errors.documentType, "Document type is required");
  assert.equal(errors.documentNumber, "Document number is required");
  assert.equal(errors.dateOfBirth, "Date of birth is required");
  assert.equal(errors.address, "Address is required");
  assert.equal(errors.idCardFront, "ID card front image is required");
  assert.equal(errors.idCardBack, "ID card back image must be a valid image file");
  assert.equal(errors.selfie, "Selfie image is required");
});
