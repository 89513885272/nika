module.exports = {
  content: ['./views/**/*.ejs'],
  theme: {
    extend: {
      colors: { navy: { DEFAULT: '#0f1b33', light: '#1b2c52' }, gold: { DEFAULT: '#c9a24b', dark: '#a8832f' } },
      fontFamily: { serif: ['"Playfair Display"', 'serif'], sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
};
