export const config = {
  contentstackApiKey: import.meta.env.VITE_CONTENTSTACK_API_KEY,
  contentstackDeliveryToken: import.meta.env.VITE_CONTENTSTACK_DELIVERY_TOKEN,
  contentstackEnvironment: import.meta.env.VITE_CONTENTSTACK_ENVIRONMENT,
  contentstackRegion: import.meta.env.VITE_CONTENTSTACK_REGION || 'us',
};
