export const intRegex = /^\d+$/
// Mercury creates 9-digit IDs; items imported from the Aya avatar catalog keep
// their original (7-12 digit) IDs so the engine can load them
export const assetRegex = /^\d{1,12}$/
export const idRegex = /^[0-9a-z]{20}$/
