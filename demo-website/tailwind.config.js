// Move the CSS code to a separate CSS file (e.g., styles.css) and keep only Tailwind config here.
// Example tailwind.config.js structure:

module.exports = {
  theme: {
    extend: {
      animation: {
        'fade-in-up': 'fade-in-up 1s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'fade-in-up': {
          'from': { opacity: '0', transform: 'translateY(30px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
      backgroundImage: {
        'diamond': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff' opacity='0.3'%3E%3Cpath d='M12 2L2 8l10 14 10-14-10-6z'/%3E%3C/svg%3E\")",
        'ring': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff' opacity='0.3'%3E%3Ccircle cx='12' cy='12' r='10' stroke='white' stroke-width='2' fill='none'/%3E%3C/svg%3E\")",
      },
    },
  },

 theme: {
    extend: {
      fontFamily: {
        serif: ['Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
}