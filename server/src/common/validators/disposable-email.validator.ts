import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Whitelist of allowed email providers
 * Only accept emails from trusted providers and educational institutions
 * Updated: 2026
 */
const ALLOWED_EMAIL_DOMAINS = [
  // Google
  'gmail.com',
  'googlemail.com',
  
  // Microsoft
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  
  // Yahoo
  'yahoo.com',
  'yahoo.com.vn',
  'ymail.com',
  
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  
  // Proton
  'protonmail.com',
  'proton.me',
  'pm.me',
  
  // Other trusted providers
  'aol.com',
  'mail.com',
  'zoho.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'tutanota.com',
  'tutanota.de',
  'fastmail.com',
  'runbox.com',
  'hushmail.com',
  
  // Vietnamese providers
  'vnu.edu.vn',
  'hust.edu.vn',
  'uit.edu.vn',
  'fpt.edu.vn',
  'vku.udn.vn',
  'tlu.edu.vn',
  'hcmus.edu.vn',
  'hcmut.edu.vn',
];

@ValidatorConstraint({ async: false })
export class IsNotDisposableEmailConstraint implements ValidatorConstraintInterface {
  validate(email: string) {
    if (!email) return false;

    const domain = email.toLowerCase().split('@')[1];
    if (!domain) return false;

    // Check if domain is in whitelist
    const isAllowedDomain = ALLOWED_EMAIL_DOMAINS.includes(domain);
    
    // Also allow educational domains (.edu, .edu.vn, .ac.*)
    const isEducationalDomain = 
      domain.endsWith('.edu.vn') || 
      domain.endsWith('.edu') ||
      domain.endsWith('.ac.vn') ||
      domain.endsWith('.ac.uk') ||
      domain.endsWith('.ac.th') ||
      domain.endsWith('.ac.jp');

    return isAllowedDomain || isEducationalDomain;
  }

  defaultMessage() {
    return 'Please use a valid email from trusted providers (Gmail, Outlook, Yahoo, etc.) or educational institutions.';
  }
}

/**
 * Custom validator decorator to only accept emails from trusted providers
 * @param validationOptions Optional validation options
 */
export function IsNotDisposableEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotDisposableEmailConstraint,
    });
  };
}
