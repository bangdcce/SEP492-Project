import React, { useRef, useState, useEffect } from 'react';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

export function OTPInput({ length = 6, value, onChange, error }: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const otpArray = value.split('').slice(0, length);
    setOtp([...otpArray, ...Array(length - otpArray.length).fill('')]);
  }, [value, length]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return;

    const newOtp = [...otp];
    newOtp[index] = digit.slice(-1);
    setOtp(newOtp);
    onChange(newOtp.join(''));

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    const newOtp = pastedData.split('').slice(0, length);
    const filledOtp = [...newOtp, ...Array(length - newOtp.length).fill('')];
    setOtp(filledOtp);
    onChange(newOtp.join(''));
    
    const nextIndex = Math.min(newOtp.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el: HTMLInputElement | null) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(index, e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          style={{
            width: '3rem',
            height: '3.5rem',
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: `2px solid ${error ? 'var(--auth-error)' : digit ? 'var(--auth-primary)' : 'var(--auth-border)'}`,
            backgroundColor: 'var(--auth-input-bg)',
            color: 'var(--auth-text)',
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
            e.target.style.borderColor = error ? 'var(--auth-error)' : 'var(--auth-primary)';
            e.target.style.boxShadow = error 
              ? '0 0 0 3px rgba(239, 68, 68, 0.1)'
              : '0 0 0 3px rgba(37, 99, 235, 0.1)';
          }}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
            e.target.style.borderColor = error ? 'var(--auth-error)' : digit ? 'var(--auth-primary)' : 'var(--auth-border)';
            e.target.style.boxShadow = 'none';
          }}
        />
      ))}
    </div>
  );
}