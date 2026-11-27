import { realpath, lstat, mkdir, chmod, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const APPROVED_PROJECT_REF = 'tiojcfemilttggcuqycq';
export const APPROVED_SUPABASE_URL = `https://${APPROVED_PROJECT_REF}.supabase.co`;
export const MEDIA_BUCKET = 'private-media';
export const MEDIA_OBJECT_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = await realpath(path.resolve(scriptDir, '../..'));

export function assertApprovedProjectRef(ref) {
  if (ref !== APPROVED_PROJECT_REF) {
    throw new Error('Project ref is not approved.');
  }
}

export function assertApprovedSupabaseUrl(value) {
  if (value !== APPROVED_SUPABASE_URL) {
    throw new Error('Supabase URL is not approved.');
  }
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== `${APPROVED_PROJECT_REF}.supabase.co` ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Supabase URL is not approved.');
  }
}

export function assertMediaObjectPath(objectPath) {
  if (typeof objectPath !== 'string' || !MEDIA_OBJECT_PATH.test(objectPath)) {
    throw new Error('Storage object path is invalid.');
  }
}

export function parseServiceFile(text, sectionName) {
  const sections = new Map();
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const section = /^\[([a-zA-Z0-9_-]+)\]$/.exec(line);
    if (section) {
      if (sections.has(section[1])) throw new Error('Duplicate service section.');
      current = new Map();
      sections.set(section[1], current);
      continue;
    }
    const entry = /^([a-zA-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!entry || !current) throw new Error('Invalid PostgreSQL service file.');
    const key = entry[1].toLowerCase();
    if (['password', 'sslpassword', 'passfile', 'hostaddr'].includes(key)) {
      throw new Error('PostgreSQL service file contains a disallowed credential or host override.');
    }
    if (current.has(key)) throw new Error('Duplicate service setting.');
    current.set(key, entry[2].replace(/^(['"])(.*)\1$/, '$2'));
  }
  const service = sections.get(sectionName);
  const allowedKeys = new Set(['host', 'port', 'dbname', 'user', 'sslmode']);
  if (
    !service ||
    [...service.keys()].some((key) => !allowedKeys.has(key)) ||
    [...allowedKeys].some((key) => !service.has(key))
  ) {
    throw new Error('PostgreSQL service file must contain only the required service settings.');
  }
  return Object.fromEntries(service);
}

export function assertHostedDatabaseService(service) {
  if (
    service.host !== `db.${APPROVED_PROJECT_REF}.supabase.co` ||
    service.port !== '5432' ||
    service.dbname !== 'postgres' ||
    service.user !== 'postgres' ||
    service.sslmode !== 'verify-full'
  ) {
    throw new Error('PostgreSQL service does not match the approved project.');
  }
}

export async function assertLocalRestoreService(service) {
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (
    !loopbackHosts.has(service.host) ||
    service.dbname !== 'bahrainrealtor_restore' ||
    service.sslmode !== 'disable' ||
    !/^[1-9]\d{0,4}$/.test(service.port) ||
    Number(service.port) > 65535 ||
    !service.user
  ) {
    throw new Error('Restore service must target the isolated local restore database.');
  }
  const addresses = isIP(service.host)
    ? [{ address: service.host }]
    : await lookup(service.host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isLoopback(address))) {
    throw new Error('Restore destination does not resolve exclusively to loopback.');
  }
}

function isLoopback(address) {
  if (address === '::1' || address.startsWith('127.')) return true;
  return address.toLowerCase().startsWith('::ffff:127.');
}

export async function assertProtectedFile(filePath, label) {
  if (!path.isAbsolute(filePath)) throw new Error(`${label} path must be absolute.`);
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid?.()) {
    throw new Error(`${label} must be a regular file owned by the current user.`);
  }
  if ((info.mode & 0o077) !== 0) {
    throw new Error(`${label} must have permissions 0600 or stricter.`);
  }
}

export async function preparePrivateOutputDirectory(directory) {
  if (!path.isAbsolute(directory)) throw new Error('Output directory must be an absolute path.');
  const target = path.resolve(directory);
  if (target === path.parse(target).root) {
    throw new Error('A filesystem root cannot be used as the backup output directory.');
  }
  assertOutsideRepository(target);
  let existingAncestor = target;
  while (true) {
    try {
      const info = await lstat(existingAncestor);
      if (existingAncestor === target && info.isSymbolicLink()) {
        throw new Error('Output directory must not be a symbolic link.');
      }
      break;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) throw error;
      existingAncestor = parent;
    }
  }
  const actualAncestor = await realpath(existingAncestor);
  assertOutsideRepository(path.resolve(actualAncestor, path.relative(existingAncestor, target)));
  await mkdir(target, { recursive: true, mode: 0o700 });
  const resolved = await realpath(target);
  assertOutsideRepository(resolved);
  const info = await stat(resolved);
  if (!info.isDirectory() || info.uid !== process.getuid?.()) {
    throw new Error('Output directory must be a directory owned by the current user.');
  }
  await chmod(resolved, 0o700);
  return resolved;
}

function assertOutsideRepository(target) {
  const relative = path.relative(REPOSITORY_ROOT, target);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Backup output directory must be outside the repository.');
  }
}

export function getServiceEnvironment(serviceFile, passwordFile) {
  if (!serviceFile || !passwordFile || !path.isAbsolute(serviceFile) || !path.isAbsolute(passwordFile)) {
    throw new Error('Set PGSERVICEFILE and PGPASSFILE to protected local config files.');
  }
  return { PGSERVICEFILE: serviceFile, PGPASSFILE: passwordFile };
}

export function sanitizedPostgresEnvironment(environment, serviceFile, passwordFile, serviceName) {
  const safe = sanitizedChildEnvironment(environment);
  return {
    ...safe,
    ...getServiceEnvironment(serviceFile, passwordFile),
    PGSERVICE: serviceName,
  };
}

export function sanitizedChildEnvironment(environment) {
  const safe = Object.fromEntries(
    Object.entries(environment).filter(([name]) =>
      !/^PG/i.test(name) && name !== 'SUPABASE_SERVICE_ROLE_KEY',
    ),
  );
  return safe;
}
