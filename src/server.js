// server.js: ponto de entrada. Carrega o .env e coloca a API para escutar numa porta.
require('dotenv').config();
const app = require('./app');

// No Render, a porta é definida automaticamente na variável PORT.
// Localmente, usa 3000 se nada for informado.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
