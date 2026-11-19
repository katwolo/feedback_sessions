// Tailwind només inclou a estils.css les classes que apareixen a index.html i alumne.html
// (també les que es creen dins del JavaScript). Després de canviar classes: npm run css
module.exports = {
  content: ['./index.html', './alumne.html'],
  theme: { extend: {} },
  plugins: []
};
