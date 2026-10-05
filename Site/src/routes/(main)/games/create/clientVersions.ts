// Places always run on the Aya 2016 client (WebAssembly Player and native
// Aya.Server), so it is the only version offered
export default Object.freeze(["2016"] as const)

export const lockedClientVersion = 2016