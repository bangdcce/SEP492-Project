const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  content = content.replace(/@\/shared\/components\/ui\/Button/g, '@/shared/components/ui/button');
  content = content.replace(/@\/shared\/components\/ui\/Input/g, '@/shared/components/ui/input');
  content = content.replace(/\.\/Button/g, './button');
  content = content.replace(/\.\/Input/g, './input');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir('d:/GradProject/SEP492-Project/client/src');
console.log('Done replacement');
