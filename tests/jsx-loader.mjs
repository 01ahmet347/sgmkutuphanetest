// Node.js --test icin JSX uzantili modulleri okuyup sucrase ile dönüştürür.
// Üretim kodu veya Vercel dağıtımı bu yükleyiciyi kullanmaz.
import { readFile } from 'node:fs/promises';
import { transform } from 'sucrase';
export async function load(url, context, nextLoad) {
  if (url.endsWith('.jsx')) {
    const source = await readFile(new URL(url), 'utf8');
    return { format:'module', shortCircuit:true, source:transform(source,
      {transforms:['jsx'],jsxRuntime:'classic',filePath:url}).code };
  }
  return nextLoad(url, context);
}
