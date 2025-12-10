const fs=require('fs');const c=fs.readFileSync('src/pages/Canva.tsx','utf8');const i=c.indexOf(\"case 'text':\");console.log(c.substring(i,i+1200));
