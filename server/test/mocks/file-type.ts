type FileTypeResult = {
  ext: string;
  mime: string;
};

const startsWithBytes = (buffer: Buffer, signature: number[]) =>
  signature.every((byte, index) => buffer[index] === byte);

const startsWithAscii = (buffer: Buffer, value: string) =>
  buffer.subarray(0, value.length).toString('ascii') === value;

export const fromBuffer = async (buffer: Buffer): Promise<FileTypeResult | undefined> => {
  if (!buffer || buffer.length === 0) {
    return undefined;
  }

  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47])) {
    return { ext: 'png', mime: 'image/png' };
  }

  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  if (startsWithAscii(buffer, 'GIF8')) {
    return { ext: 'gif', mime: 'image/gif' };
  }

  if (startsWithAscii(buffer, '%PDF')) {
    return { ext: 'pdf', mime: 'application/pdf' };
  }

  if (startsWithAscii(buffer, 'PK')) {
    return { ext: 'zip', mime: 'application/zip' };
  }

  if (buffer.length >= 12 && startsWithAscii(buffer, 'RIFF') && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }

  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand.startsWith('mp4') || brand === 'isom' || brand === 'iso2') {
      return { ext: 'mp4', mime: 'video/mp4' };
    }
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('hex') === '1a45dfa3' &&
    buffer.subarray(4, 8).toString('hex') !== ''
  ) {
    return { ext: 'webm', mime: 'video/webm' };
  }

  if (
    buffer.length >= 3 &&
    startsWithBytes(buffer, [0x49, 0x44, 0x33])
  ) {
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }

  if (buffer.length >= 12 && startsWithAscii(buffer, 'RIFF') && buffer.subarray(8, 12).toString('ascii') === 'WAVE') {
    return { ext: 'wav', mime: 'audio/wav' };
  }

  return undefined;
};
