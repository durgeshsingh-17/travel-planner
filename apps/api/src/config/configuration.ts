export const configuration = () => ({
  api: {
    port: parseInt(process.env.API_PORT ?? '3000', 10),
    corsOrigin: process.env.API_CORS_ORIGIN ?? 'http://localhost:4200'
  },
  database: {
    url: process.env.DATABASE_URL
  },
  pricing: {
    petrolFuelPriceInr: parseFloat(process.env.FUEL_PRICE_PETROL_INR ?? '105'),
    dieselFuelPriceInr: parseFloat(process.env.FUEL_PRICE_DIESEL_INR ?? '94')
  }
});
