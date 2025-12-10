const fs = require('fs');  
let c = fs.readFileSync('src/pages/Canva.tsx', 'utf8');  
c = c.split('const align = element.textAlign || ').join('const align = element.textAlign ');  
