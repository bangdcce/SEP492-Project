import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * List of disposable/temporary email domains
 * Updated: 2026 - Common temporary email services
 */
const DISPOSABLE_EMAIL_DOMAINS = [
  // Popular temporary email services
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'mailinator.com',
  'maildrop.cc',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'getnada.com',
  'fakeinbox.com',
  'trashmail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monmail.fr.nf',
  'hide.biz.st',
  'mytrashmail.com',
  'mintemail.com',
  'emailondeck.com',
  'sharklasers.com',
  'grr.la',
  'emltmp.com',
  'dispostable.com',
  'spambox.us',
  'spam4.me',
  'anonymbox.com',
  'bobmail.info',
  'sendspamhere.com',
  'tempinbox.com',
  'klzlk.com',
  'filzmail.com',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'einrot.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',
  '0-mail.com',
  'mail-temporaire.fr',
  'meltmail.com',
  'mytemp.email',
  'temp-mail.io',
  'fakemail.net',
  'throwawaymail.com',
  'inboxbear.com',
  'mailcatch.com',
  'mailnesia.com',
  'receiveee.com',
  '33mail.com',
  'anonbox.net',
  'dropmail.me',
  'getairmail.com',
  'harakirimail.com',
  'incognitomail.com',
  'instantemailaddress.com',
  'luxusmail.org',
  'mt2014.com',
  'mt2015.com',
  'pokemail.net',
  'proxymail.eu',
  'putthisinyourspamdatabase.com',
  'spamfree24.org',
  'tempemail.net',
  'tempsky.com',
  'thankyou2010.com',
  'trash2009.com',
  'trashymail.com',
  'vpn.st',
  'wegwerfmail.de',
  'wegwerfemail.de',
  'zehnminuten.de',
  'zehnminutenmail.de',
  'mailsac.com',
  'moakt.com',
  'mohmal.com',
  'rootfest.net',
  'spamgourmet.com',
  'tmailinator.com',
  'upliftnow.com',
  'veryrealemail.com',
  'vidchart.com',
  'viditag.com',
  'viewcastmedia.com',
  'viewcastmedia.net',
  'viewcastmedia.org',
  'vubby.com',
  'wasteland.rfc822.org',
  'webemail.me',
  'webm4il.info',
  'wh4f.org',
  'whyspam.me',
  'willselfdestruct.com',
  'winemaven.info',
  'wronghead.com',
  'wuzup.net',
  'wuzupmail.net',
  'xagloo.com',
  'xemaps.com',
  'xents.com',
  'xmaily.com',
  'xoxy.net',
  'yapped.net',
  'zetmail.com',
  'zoaxe.com',
  'zoemail.net',
  'zomg.info',
];

@ValidatorConstraint({ async: false })
export class IsNotDisposableEmailConstraint implements ValidatorConstraintInterface {
  validate(email: string) {
    if (!email) return false;

    const domain = email.toLowerCase().split('@')[1];
    if (!domain) return false;

    // Check if domain is in disposable list
    return !DISPOSABLE_EMAIL_DOMAINS.includes(domain);
  }

  defaultMessage() {
    return 'Disposable or temporary email addresses are not allowed. Please use a permanent email address.';
  }
}

/**
 * Custom validator decorator to reject disposable email addresses
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
