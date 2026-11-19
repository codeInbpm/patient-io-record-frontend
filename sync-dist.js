const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, 'dist/build/mp-weixin');
const destDir = path.resolve(__dirname, 'dist/dev/mp-weixin');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(srcDir)) {
  console.log('正在将最新构建产物同步至 dist/dev/mp-weixin ...');
  copyRecursiveSync(srcDir, destDir);
  console.log('同步完成！');
}
