import fs from 'node:fs';

const filePath = 'node_modules/pg-gateway/dist/chunk-PGRRI4HM.js';
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replaceAll(
    'if (this.duplex?.writable?.abort) await this.duplex.writable.abort()',
    '(this.duplex?.writable?.abort ? await this.duplex.writable.abort() : undefined)'
  );
  content = content.replaceAll(
    'await this.duplex.writable.abort()',
    '(this.duplex?.writable?.abort ? await this.duplex.writable.abort() : undefined)'
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Successfully patched pg-gateway abort handling with expression');
}
