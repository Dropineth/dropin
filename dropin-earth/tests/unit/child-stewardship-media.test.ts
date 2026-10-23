import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { MEDIA_LIMITS, perceptualDistance, processSyntheticMediaBytes, rejectPublicMediaUpload } from '../../services/api/src/domain/child-stewardship/media.js';
import { syntheticMediaFixtures } from '../../services/api/src/domain/child-stewardship/media-fixtures.js';
const png=Buffer.from(syntheticMediaFixtures['demo-media-pattern-png'].base64,'base64');
const jpeg=Buffer.from(syntheticMediaFixtures['demo-media-oriented-jpeg'].base64,'base64');

test('real decoder applies EXIF orientation then removes all private metadata',async()=>{
  const raw=await sharp(jpeg).metadata();assert.equal(raw.orientation,6);assert.ok(raw.exif);assert.ok(raw.icc);
  const processed=await processSyntheticMediaBytes(jpeg),clean=await sharp(processed.sanitized).metadata();
  assert.equal(processed.width,48);assert.equal(processed.height,64);assert.equal(clean.format,'png');
  for(const field of ['exif','icc','iptc','xmp','orientation']as const)assert.equal(clean[field],undefined);
  assert.equal(processed.sanitized.includes(Buffer.from('private metadata')),false);assert.equal(processed.evidenceLevel,'E0');
});
test('canonical bytes and pixel digests are deterministic; perceptual match remains only a flag',async()=>{
  const first=await processSyntheticMediaBytes(png),second=await processSyntheticMediaBytes(png);
  assert.deepEqual(first.sanitized,second.sanitized);assert.equal(first.pixelDigest,second.pixelDigest);assert.equal(first.rawDigest,syntheticMediaFixtures['demo-media-pattern-png'].sha256);
  assert.equal(perceptualDistance(first.perceptualHashes[0]!,second.perceptualHashes[0]!),0);assert.equal(perceptualDistance('0000000000000000','ffffffffffffffff'),64);
  const index=JSON.parse(first.index.toString());assert.equal(index.heuristicOnly,true);assert.equal(index.evidenceLevel,'E0');
});
test('SVG, active content, truncation and appended or concatenated polyglots are rejected',async()=>{
  for(const bytes of [Buffer.from('<svg><script>alert(1)</script></svg>'),Buffer.from('<html>not media</html>'),png.subarray(0,100),jpeg.subarray(0,jpeg.length-2),Buffer.concat([png,Buffer.from('<script/>')]),Buffer.concat([jpeg,jpeg])])await assert.rejects(()=>processSyntheticMediaBytes(bytes));
});
test('byte and predecode pixel budgets reject compressed bombs and oversized inputs',async()=>{
  await assert.rejects(()=>processSyntheticMediaBytes(Buffer.alloc(MEDIA_LIMITS.inputBytes+1)),/MEDIA_BYTE_LIMIT/);
  const bomb=Buffer.from(png);bomb.writeUInt32BE(100_000,16);bomb.writeUInt32BE(100_000,20);await assert.rejects(()=>processSyntheticMediaBytes(bomb),/MEDIA_PIXEL_LIMIT/);
  const corrupt=Buffer.from(png);corrupt[100]=corrupt[100]!^255;await assert.rejects(()=>processSyntheticMediaBytes(corrupt));
});
test('actual valid large raster is resized below the output dimension cap',async()=>{
  const large=await sharp({create:{width:2048,height:1200,channels:3,background:'#448822'}}).png().toBuffer();
  const processed=await processSyntheticMediaBytes(large);assert.equal(processed.width,1024);assert.equal(processed.height,600);
});
test('public real upload remains hard closed independent of synthetic processing capability',()=>{
  assert.throws(()=>rejectPublicMediaUpload(),(error:unknown)=>error instanceof Error&&error.message==='REAL_MEDIA_UPLOAD_DISABLED'&&'status'in error&&error.status===503);
});
