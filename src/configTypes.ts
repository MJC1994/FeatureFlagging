export interface MagazineConfig {
  description: string;
  imageUrl: string;
  srTitle: string;
  title: string;
  url: string;
}

export interface DocumentsConfig {
  accessibleDocumentLeafletPdfUrl: string;
  accessibleDocumentLeafletPdfEasyReadUrl: string;
  accessibleDocumentPolicyPdfUrl: string;
  accessibleDocumentPolicyPdfEasyReadUrl: string;
  accessibleDocumentRollingStockUrl: string;
  accessibleWordLargePrintAudioUrl: string;
  magazine: MagazineConfig;
  prioritySeatMoreInfoUrl: string;
}

export interface WebchatConfig {
  url: string;
}

export interface SmartcardConfig {
  warningAtScanning: string;
}

export interface BestFareFinderConfig {
  defaultNumberOfResults: number;
  defaultNLC: string;
}

/** Nested brand config matching the runtime API `config` object */
export interface BrandConfig {
  apiTimeoutInMilliseconds: number;
  apiJPJourneyPlanTimeoutInMilliseconds: number;
  documents: DocumentsConfig;
  webchat: WebchatConfig;
  smartcard: SmartcardConfig;
  bestFareFinder: BestFareFinderConfig;
}

/** Full API payload shape: config + features + warnings */
export interface BrandEnvironmentPayload {
  config: BrandConfig;
  features: Record<string, boolean>;
  warnings: string[];
}
