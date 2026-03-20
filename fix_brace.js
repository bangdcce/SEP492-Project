const fs = require('fs');
const file = 'd:/GradProject/SEP492-Project/client/src/features/requests/RequestDetailPage.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
lines.splice(307, 1);
fs.writeFileSync(file, lines.join('\n'));
console.log('Fixed brace');
