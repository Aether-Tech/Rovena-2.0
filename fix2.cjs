const fs = require('fs'); 
let c = fs.readFileSync('src/pages/Canva.tsx', 'utf8'); 
c = c.replace(/ctx\.textAlign = align;/g, 'const align_saved = align;'); 
c = c.replace(/let textX = x;/g, '''); 
fs.writeFileSync('src/pages/Canva.tsx', c); 
console.log('Done');
