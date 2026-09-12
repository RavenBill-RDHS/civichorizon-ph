// CivicHorizon public configuration.
// Set the published Google Form URL once, commit, and redeploy.
// Do not put private credentials or API secrets in this file.
export const CIVICHORIZON_CONFIG = {
  // Analytics is optional. Add your GA4 Measurement ID (G-XXXXXXXXXX) before production.
  analytics: {
    enabled: true,
    ga4MeasurementId: "",
    // Microsoft Clarity is optional and can be enabled later with your project ID.
    clarityProjectId: ""
  },
  // Google Form used for "Was this useful?" feedback and suggestions.
  feedbackFormUrl: "https://forms.gle/A95VaK4HAhp4oqjB9",
  listingSubmissionFormUrl: "https://forms.gle/A95VaK4HAhp4oqjB9",
  defaultListingDatasetId: "civichorizon_community_listings",
  publicListingSubmissionEnabled: true,
  businessListing: {
    basicLabel: "Basic — Free",
    enhancedLabel: "Enhanced — Premium",
    enhancedDescription: "Enhanced business listings may include contact details, opening hours, description, photos, and other approved information."
  }
};
