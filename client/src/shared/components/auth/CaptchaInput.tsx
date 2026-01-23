import ReCAPTCHA from "react-google-recaptcha";

interface ReCaptchaInputProps {
  onChange: (token: string | null) => void;
  error?: string;
}

export function CaptchaInput({ onChange, error }: ReCaptchaInputProps) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    console.error("VITE_RECAPTCHA_SITE_KEY is not configured");
    return (
      <div style={{ color: "red", fontSize: "0.875rem" }}>
        reCAPTCHA configuration missing. Please contact administrator.
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="recaptcha"
        style={{
          display: "block",
          marginBottom: "0.5rem",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--auth-text)",
        }}
      >
        Security Verification{" "}
        <span style={{ color: "var(--auth-error)" }}>*</span>
      </label>

      <div style={{ marginBottom: "0.75rem" }}>
        <ReCAPTCHA sitekey={siteKey} onChange={onChange} theme="light" hl="en" />
      </div>

      {error && (
        <p
          style={{
            color: "var(--auth-error)",
            fontSize: "0.875rem",
            marginTop: "0.5rem",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
