import React from 'react';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  helperText?: string;
}

export function Input({ label, error, success, helperText, ...props }: InputProps) {
  return (
    <div>
      {label && (
      <label 
        htmlFor={props.id}
        style={{ 
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--auth-text)',
        }}
      >
        {label} {props.required && <span style={{ color: 'var(--auth-error)' }}>*</span>}
      </label>
      )}
      <div className="relative">
        <input
          {...props}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            paddingRight: success ? '3rem' : '1rem',
            borderRadius: '8px',
            border: `2px solid ${error ? 'var(--auth-error)' : success ? 'var(--auth-success)' : 'var(--auth-border)'}`,
            fontSize: '1rem',
            color: 'var(--auth-text)',
            backgroundColor: 'var(--auth-input-bg)',
            outline: 'none',
            transition: 'all 0.2s ease',
            ...props.style,
          }}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
            e.target.style.borderColor = error ? 'var(--auth-error)' : success ? 'var(--auth-success)' : 'var(--auth-primary)';
            e.target.style.boxShadow = error 
              ? '0 0 0 3px rgba(239, 68, 68, 0.1)' 
              : success 
              ? '0 0 0 3px rgba(22, 163, 74, 0.1)'
              : '0 0 0 3px rgba(37, 99, 235, 0.1)';
            props.onFocus?.(e);
          }}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
            e.target.style.borderColor = error ? 'var(--auth-error)' : success ? 'var(--auth-success)' : 'var(--auth-border)';
            e.target.style.boxShadow = 'none';
            props.onBlur?.(e);
          }}
        />
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <Check className="w-5 h-5" style={{ color: 'var(--auth-success)' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ color: 'var(--auth-error)', fontSize: '0.875rem', marginTop: '0.5rem' }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {!error && helperText && (
        <p style={{ color: 'var(--auth-text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          {helperText}
        </p>
      )}
    </div>
  );
}