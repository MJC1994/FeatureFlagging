import type { BrandConfig, BrandEnvironmentPayload } from './configTypes';
import apiExample from './data/apiExample.json';

export const EXAMPLE_PAYLOAD = apiExample as BrandEnvironmentPayload;

export function emptyMagazine() {
  return {
    description: '',
    imageUrl: '',
    srTitle: '',
    title: '',
    url: '',
  };
}

export function emptyBrandConfig(): BrandConfig {
  return {
    apiTimeoutInMilliseconds: 30000,
    apiJPJourneyPlanTimeoutInMilliseconds: 30000,
    documents: {
      accessibleDocumentLeafletPdfUrl: '',
      accessibleDocumentLeafletPdfEasyReadUrl: '',
      accessibleDocumentPolicyPdfUrl: '',
      accessibleDocumentPolicyPdfEasyReadUrl: '',
      accessibleDocumentRollingStockUrl: '',
      accessibleWordLargePrintAudioUrl: '',
      magazine: emptyMagazine(),
      prioritySeatMoreInfoUrl: '',
    },
    webchat: { url: '' },
    smartcard: { warningAtScanning: '' },
    bestFareFinder: {
      defaultNumberOfResults: 4,
      defaultNLC: '',
    },
  };
}

export function cloneConfig(config: BrandConfig): BrandConfig {
  return structuredClone(config);
}

/** Human-readable description from a camelCase feature key */
export function featureKeyToDescription(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/** Infer location tags from a feature key */
export function featureKeyToTags(key: string): string[] {
  const k = key.toLowerCase();
  const tags: string[] = [];

  if (
    /paypal|applepay|googlepay|payment|braintree|pay360|cardpayment/.test(k)
  ) {
    tags.push('payments');
  }
  if (/refund/.test(k)) tags.push('refunds');
  if (/railcard|promo|discount|evoucher/.test(k)) tags.push('discounts');
  if (
    /assist|priority|sunflower|jamscheme|accessible|passengerassist/.test(k)
  ) {
    tags.push('accessibility');
  }
  if (
    /smartcard|keygo|sticket|eticket|itso|ticket|wallet|collection/.test(k)
  ) {
    tags.push('tickets');
  }
  if (/webchat|message|airship|notification/.test(k)) tags.push('messaging');
  if (/widget/.test(k)) tags.push('widgets');
  if (/localescape/.test(k)) tags.push('local-escapes');
  if (/reservation|seat|bike/.test(k)) tags.push('reservations');
  if (/delayrepay|charity|carbon/.test(k)) tags.push('delay-repay');
  if (/magazine|rating|reward|route/.test(k)) tags.push('engagement');
  if (/station|parking|calling|homework/.test(k)) tags.push('stations');

  if (tags.length === 0) tags.push('general');
  return [...new Set(tags)];
}
