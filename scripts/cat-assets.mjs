// Cat sprite assets: the pixel cats by Last tick (https://last-tick.itch.io/animated-pixel-cats-64x64)
// may be used on this site but not redistributed as files. The sheets therefore never live in git
// in the clear: the repo carries only an AES-256-GCM encrypted copy (cat-assets/sprites.enc), and
// this script decrypts it into public/cat/ (git-ignored) before dev and build.
//
//   node scripts/cat-assets.mjs keygen                 print a new key (put it in .env and the CI secret)
//   node scripts/cat-assets.mjs pack <extracted PACK>  encrypt the black and white sheets from the pack
//   node scripts/cat-assets.mjs unpack                 decrypt into public/cat/ (skips quietly without a key)
//
// The key is read from CAT_ASSETS_KEY in the environment or in .env.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const encPath = join(root, "cat-assets", "sprites.enc");
const outDir = join(root, "public", "cat");
const MAGIC = Buffer.from("CATSPR1");
// sheet in the pack -> name served by the site
const SHEETS = { "cat 1": "black.png", "cat 3": "white.png" };

function readKey() {
	let key = process.env.CAT_ASSETS_KEY;
	const envFile = join(root, ".env");
	if (!key && existsSync(envFile)) {
		const line = readFileSync(envFile, "utf8")
			.split(/\r?\n/)
			.find((l) => l.startsWith("CAT_ASSETS_KEY="));
		key = line?.slice("CAT_ASSETS_KEY=".length).trim();
	}
	if (!key) return null;
	const buf = Buffer.from(key, "base64");
	if (buf.length !== 32) throw new Error("CAT_ASSETS_KEY must be 32 bytes, base64-encoded (run: keygen)");
	return buf;
}

function pack(dir) {
	const key = readKey();
	if (!key) throw new Error("No CAT_ASSETS_KEY. Run keygen and add it to .env first.");
	if (!dir || !existsSync(dir)) throw new Error("Pass the extracted pack folder (the one with 'cat 1 (64x64).png').");
	const files = {};
	for (const [prefix, name] of Object.entries(SHEETS)) {
		const found = readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith(".png"));
		if (!found) throw new Error(`Missing '${prefix} (64x64).png' in ${dir}`);
		files[name] = readFileSync(join(dir, found)).toString("base64");
	}
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const body = Buffer.concat([cipher.update(JSON.stringify(files)), cipher.final()]);
	mkdirSync(join(root, "cat-assets"), { recursive: true });
	writeFileSync(encPath, Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]));
	console.log(`cat-assets: encrypted ${Object.keys(files).join(", ")} -> cat-assets/sprites.enc`);
	unpack();
}

function unpack() {
	const key = readKey();
	if (!key) {
		console.warn("cat-assets: no CAT_ASSETS_KEY, skipping (the site builds without the cat).");
		return;
	}
	if (!existsSync(encPath)) {
		console.warn("cat-assets: cat-assets/sprites.enc not found, skipping.");
		return;
	}
	const data = readFileSync(encPath);
	if (!data.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("cat-assets: not a sprites.enc file");
	const ivEnd = MAGIC.length + 12;
	const iv = data.subarray(MAGIC.length, ivEnd);
	const tag = data.subarray(ivEnd, ivEnd + 16);
	const decipher = createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(tag);
	const files = JSON.parse(Buffer.concat([decipher.update(data.subarray(ivEnd + 16)), decipher.final()]).toString());
	mkdirSync(outDir, { recursive: true });
	for (const [name, b64] of Object.entries(files)) writeFileSync(join(outDir, name), Buffer.from(b64, "base64"));
	console.log(`cat-assets: decrypted ${Object.keys(files).join(", ")} -> public/cat/`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "keygen") console.log(randomBytes(32).toString("base64"));
else if (cmd === "pack") pack(arg && resolve(arg));
else if (cmd === "unpack") unpack();
else {
	console.error("usage: node scripts/cat-assets.mjs keygen | pack <extracted pack dir> | unpack");
	process.exit(1);
}
