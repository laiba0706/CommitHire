export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:'#0a0a0a', surface:'#111111', surface2:'#1a1a1a', surface3:'#222222',
        border:'#2a2a2a', border2:'#333333',
        accent:'#00e5a0', accent2:'#3d7fff', warn:'#f5b731', danger:'#ef4444',
        ink:'#ffffff', muted:'#888888', faint:'#444444',
      },
      fontFamily: {
        sans:['Inter','sans-serif'],
        mono:['"DM Mono"','monospace'],
        display:['Syne','sans-serif'],
      },
    },
  },
  plugins: [],
}