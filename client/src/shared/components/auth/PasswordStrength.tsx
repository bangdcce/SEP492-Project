interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const getStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '', color: '' };
    
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;

    if (strength <= 2) return { level: 1, label: 'Weak', color: '#EF4444' };
    if (strength <= 4) return { level: 2, label: 'Medium', color: '#F59E0B' };
    return { level: 3, label: 'Strong', color: '#16A34A' };
  };

  const strength = getStrength(password);
  if (!password) return null;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            style={{
              flex: 1,
              height: '0.25rem',
              borderRadius: '0.125rem',
              backgroundColor: level <= strength.level ? strength.color : '#E5E7EB',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: '0.875rem', color: strength.color, fontWeight: 500 }}>
        {strength.label}
      </p>
    </div>
  );
}
