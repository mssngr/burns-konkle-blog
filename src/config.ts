// Shared claims live in a Pantry (https://getpantry.cloud) basket.
// The ID is public by necessity: anyone with it can read and write the basket.
export const PANTRY_ID = '2510fe0d-5dc3-42ff-86a5-2ab6b97f4802'
export const BASKET = import.meta.env.DEV ? 'registry-dev' : 'registry'
