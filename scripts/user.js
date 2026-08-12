/**
 * Gestion des comptes en ligne de commande (les comptes sont créés à la main,
 * puis le mot de passe est transmis à l'utilisateur).
 *
 * Usage :
 *   npm run user:create -- <identifiant> [mot-de-passe] [--name "Nom affiché"]
 *       Crée un compte. Sans mot de passe, en génère un et l'affiche.
 *   npm run user:passwd -- <identifiant> [mot-de-passe]
 *       Réinitialise le mot de passe (le régénère si absent). Invalide les sessions existantes.
 *   npm run user:list
 *       Liste les comptes.
 *
 * Astuce : fixer SESSION_SECRET dans l'environnement (même valeur que le serveur)
 * n'est pas requis ici — la création/écriture ne signe aucune session.
 */
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/lib/server/auth.js';
import { createUser, updatePasswordHash, listUsers } from '../src/lib/server/users.js';

// Alphabet sans caractères ambigus (0/O, 1/l/I) pour un mot de passe dictable au téléphone.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Mot de passe aléatoire lisible : 4 groupes de 4, séparés par des tirets. */
function generatePassword() {
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) out += '-';
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Extrait `--name "..."` des arguments et renvoie { name, rest }. */
function parseArgs(argv) {
  const rest = [];
  let name = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name') {
      name = argv[i + 1] ?? '';
      i++;
    } else {
      rest.push(argv[i]);
    }
  }
  return { name, rest };
}

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const [command, ...raw] = process.argv.slice(2);
  const { name, rest } = parseArgs(raw);

  if (command === 'create') {
    const username = rest[0];
    if (!username) die('Identifiant requis : npm run user:create -- <identifiant> [mot-de-passe]');
    const password = rest[1] || generatePassword();
    const generated = !rest[1];
    let user;
    try {
      user = await createUser(username, hashPassword(password), name);
    } catch (err) {
      die(err instanceof Error ? err.message : String(err));
    }
    console.log('✓ Compte créé');
    console.log(`  identifiant   : ${user.username}`);
    if (user.displayName) console.log(`  nom affiché   : ${user.displayName}`);
    console.log(`  mot de passe  : ${password}${generated ? '  (généré)' : ''}`);
    console.log('\n→ Transmets ces identifiants à l\'utilisateur.');
    return;
  }

  if (command === 'passwd') {
    const username = rest[0];
    if (!username) die('Identifiant requis : npm run user:passwd -- <identifiant> [mot-de-passe]');
    const password = rest[1] || generatePassword();
    const generated = !rest[1];
    const ok = await updatePasswordHash(username, hashPassword(password));
    if (!ok) die(`Aucun compte « ${username} »`);
    console.log('✓ Mot de passe réinitialisé (les sessions existantes sont invalidées)');
    console.log(`  identifiant   : ${username}`);
    console.log(`  mot de passe  : ${password}${generated ? '  (généré)' : ''}`);
    return;
  }

  if (command === 'list') {
    const users = await listUsers();
    if (users.length === 0) {
      console.log('Aucun compte.');
      return;
    }
    for (const u of users) {
      const label = u.displayName ? ` (${u.displayName})` : '';
      console.log(`  ${u.username}${label}  ·  créé le ${u.createdAt}`);
    }
    return;
  }

  die(
    'Commande inconnue. Utilise : create | passwd | list\n' +
      '  npm run user:create -- <identifiant> [mot-de-passe] [--name "Nom"]'
  );
}

main();
