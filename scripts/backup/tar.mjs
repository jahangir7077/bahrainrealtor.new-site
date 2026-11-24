export function createTarHeader(archivePath, size) {
  const buffer = Buffer.alloc(512);
  const split = archivePath.lastIndexOf('/');
  const prefix = split < 0 ? '' : archivePath.slice(0, split);
  const name = split < 0 ? archivePath : archivePath.slice(split + 1);
  if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) {
    throw new Error('Archive member path exceeds the supported format.');
  }
  buffer.write(name, 0, 100, 'utf8');
  buffer.write('0000600\0', 100, 8, 'ascii');
  buffer.write('0000000\0', 108, 8, 'ascii');
  buffer.write('0000000\0', 116, 8, 'ascii');
  buffer.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
  buffer.write(`${Math.floor(Date.now() / 1000).toString(8).padStart(11, '0')}\0`, 136, 12, 'ascii');
  buffer.fill(0x20, 148, 156);
  buffer.write('0', 156, 1, 'ascii');
  buffer.write('ustar\0', 257, 6, 'ascii');
  buffer.write('00', 263, 2, 'ascii');
  buffer.write(prefix, 345, 155, 'utf8');
  const checksum = buffer.reduce((sum, byte) => sum + byte, 0);
  buffer.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return buffer;
}

async function writeChunk(stream, chunk) {
  await new Promise((resolve, reject) => {
    stream.write(chunk, (error) => (error ? reject(error) : resolve()));
  });
}

export async function writeTarEntry(stream, archivePath, data) {
  await writeChunk(stream, createTarHeader(archivePath, data.length));
  if (data.length) await writeChunk(stream, data);
  const padding = (512 - (data.length % 512)) % 512;
  if (padding) await writeChunk(stream, Buffer.alloc(padding));
}
