const PORTA = process.env.PORT || 3001;
const SEGREDO_JWT = process.env.JWT_SECRET || "your-super-secret-jwt-key";

module.exports = {
  PORTA,
  SEGREDO_JWT,
};
