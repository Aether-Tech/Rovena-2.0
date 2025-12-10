const fs=require('fs');  
let c=fs.readFileSync('src/pages/Canva.tsx','utf8');  
c=c.replace('ctx.textAlign = align;','// calc align per line');  
fs.writeFileSync('src/pages/Canva.tsx',c);  
console.log('Step 1 done');  
